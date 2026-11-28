-- Checks requested places: private until approved, then public. Run it in the
-- Supabase SQL editor as postgres. It acts as golfer A (who asks), golfer B,
-- a guest and an admin, and always ends with the error
-- "added_places: all checks passed", which rolls everything back. Any other
-- error is a failed check.

do $$
declare
  place text;
  n int;
  admin_id text := (select user_id from private.admins limit 1);
  hours jsonb := '[{"days": [0,1,2,3,4,5,6], "open": "08:00", "close": "21:00"}]';
  areas jsonb := '[{"id": "range", "kind": "range", "label": "Driving range", "outdoor": true}, {"id": "putting", "kind": "putting", "label": "Putting green", "outdoor": true}]';
begin
  -- Golfer A asks for a place, sees it, and posts there.
  perform set_config('request.jwt.claims', '{"sub": "test-golfer-a", "role": "authenticated"}', true);
  execute 'set local role authenticated';
  place := public.request_place('Test Range Milwaukee', 'Milwaukee, WI', '', 43.04, -87.91, 'walk_in', areas, hours, '', 'https://example.com');
  select count(*) into n from public.added_places where id = place;
  if n <> 1 then raise exception 'FAIL: A can''t see the place they asked for'; end if;
  perform public.post_report(place, true, '{"range": "limited"}', 'quiet', 'my own note', 'no', 'Mats only today', null);
  select count(*) into n from public.reports where place_id = place;
  if n <> 1 then raise exception 'FAIL: A can''t see their report there (%)', n; end if;

  -- Golfer B can't see the place or its report, or post there.
  perform set_config('request.jwt.claims', '{"sub": "test-golfer-b", "role": "authenticated"}', true);
  select count(*) into n from public.added_places where id = place;
  if n <> 0 then raise exception 'FAIL: B can see A''s pending place'; end if;
  select count(*) into n from public.reports where place_id = place;
  if n <> 0 then raise exception 'FAIL: B can read reports at A''s pending place'; end if;
  begin
    perform public.post_report(place, true, '{"range": "good"}', null, null, 'no', null, null);
    raise exception 'FAIL: B could post at A''s pending place';
  exception when check_violation then null;
  end;

  -- A guest can't either.
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('request.headers', '{"cf-connecting-ip": "203.0.113.9"}', true); -- a documentation-only IP
  execute 'set local role anon';
  select count(*) into n from public.reports where place_id = place;
  if n <> 0 then raise exception 'FAIL: a guest can read reports at a pending place'; end if;
  begin
    perform public.post_guest_report(place, true, '{"range": "good"}', null, null, null);
    raise exception 'FAIL: a guest could post at a pending place';
  exception when check_violation then null;
  end;

  -- Only admins decide; B can't.
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"sub": "test-golfer-b", "role": "authenticated"}', true);
  execute 'set local role authenticated';
  begin
    perform public.admin_decide_place(place, true, null);
    raise exception 'FAIL: a non-admin approved a place';
  exception when insufficient_privilege then null;
  end;

  -- An admin sees the request (to review it) but not its reports.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select count(*) into n from public.added_places where id = place;
  if n <> 1 then raise exception 'FAIL: the admin can''t see the request'; end if;
  select count(*) into n from public.reports where place_id = place;
  if n <> 0 then raise exception 'FAIL: the admin can read the private reports'; end if;

  -- The patterns (public) leave the pending place out.
  execute 'reset role';
  perform private.rebuild_place_patterns();
  if exists (select 1 from public.place_patterns where place_id = place) then
    raise exception 'FAIL: patterns were built for a pending place';
  end if;

  -- Approved: now B sees the place and the report, and can post.
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  perform public.admin_decide_place(place, true, 'Looks right');
  perform set_config('request.jwt.claims', '{"sub": "test-golfer-b", "role": "authenticated"}', true);
  select count(*) into n from public.added_places where id = place and status = 'approved';
  if n <> 1 then raise exception 'FAIL: B can''t see the approved place'; end if;
  select count(*) into n from public.reports where place_id = place;
  if n <> 1 then raise exception 'FAIL: B can''t read reports at the approved place (%)', n; end if;
  perform public.post_report(place, true, '{"putting": "good"}', null, null, 'no', null, null);

  -- Bad requests are refused: no areas, an area the app can't draw, a bad website.
  perform set_config('request.jwt.claims', '{"sub": "test-golfer-a", "role": "authenticated"}', true);
  begin
    perform public.request_place('No Areas', 'Somewhere', '', 40, -88, 'walk_in', '[]', hours, '', '');
    raise exception 'FAIL: a place with no areas was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.request_place('Odd Area', 'Somewhere', '', 40, -88, 'walk_in', '[{"id": "pool", "kind": "pool", "label": "Pool", "outdoor": true}]', hours, '', '');
    raise exception 'FAIL: an unknown area kind was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.request_place('Bad Site', 'Somewhere', '', 40, -88, 'walk_in', areas, hours, '', 'javascript:alert(1)');
    raise exception 'FAIL: a javascript: website was accepted';
  exception when check_violation then null;
  end;

  -- At most 3 waiting at once.
  perform public.request_place('Second', 'Somewhere', '', 40, -88, 'walk_in', areas, '"24/7"', '', '');
  perform public.request_place('Third', 'Somewhere', '', 40, -88, 'walk_in', areas, '"24/7"', '', '');
  perform public.request_place('Fourth', 'Somewhere', '', 40, -88, 'walk_in', areas, '"24/7"', '', '');
  begin
    perform public.request_place('Fifth', 'Somewhere', '', 40, -88, 'walk_in', areas, '"24/7"', '', '');
    raise exception 'FAIL: a 4th waiting request was accepted';
  exception when others then
    if sqlstate <> 'RR429' then raise; end if;
  end;

  -- Signed out, no requests at all.
  execute 'reset role';
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  execute 'set local role anon';
  begin
    perform public.request_place('Anon', 'Somewhere', '', 40, -88, 'walk_in', areas, hours, '', '');
    raise exception 'FAIL: a guest could request a place';
  exception when insufficient_privilege then null;
  end;

  execute 'reset role';
  raise exception 'added_places: all checks passed';
end;
$$;
