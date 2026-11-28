-- Checks private.rebuild_place_patterns() against fixture reports.
-- Run it in the Supabase SQL editor (or any psql session as postgres). Everything it
-- inserts is rolled back at the end: it always finishes with the error
-- "place_patterns: all checks passed", which is what undoes it. Any other
-- error is a failed check.
--
-- Fixtures, at Cog Hill, in November 2025 (Chicago time):
--   Saturday mornings: 4 "packed" + 1 "walk right in"       -> packed, 4 of 5
--   plus 2 hidden "walk right in" (admin, votes)             -> don't count
--   Tuesday evenings: 2 "packed"                             -> too few, no pattern
--   Range: limited in 3 of the 4 November ratings            -> limited, 3 of 4
--   Short-game area: 2 good, 2 closed                        -> no clear pattern

do $$
declare
  p record;
  sat_morning timestamptz;
begin
  -- Only the fixtures count at Cog Hill: its real reports are marked hidden
  -- for the test (undone by the rollback, like everything else here).
  update public.reports set hidden_at = now() where place_id = 'cog-hill';

  -- Saturdays in Nov 2025, 9 AM Chicago (15:00 UTC).
  for i in 0..3 loop
    sat_morning := timestamptz '2025-11-01 15:00:00+00' + make_interval(days => 7 * i);
    insert into public.reports (place_id, created_at, place_open, areas, crowd)
    values ('cog-hill', sat_morning, true,
            jsonb_build_object('range', case when i < 3 then 'limited' else 'good' end,
                               'chipping', case when i < 2 then 'good' else 'closed' end),
            'busy');
  end loop;
  insert into public.reports (place_id, created_at, place_open, areas, crowd)
  values ('cog-hill', '2025-11-29 15:30:00+00', true, '{}', 'quiet');

  -- Hidden by an admin, and voted down: neither counts.
  insert into public.reports (place_id, created_at, place_open, areas, crowd, hidden_at)
  values ('cog-hill', '2025-11-29 16:00:00+00', true, '{"range": "good"}', 'quiet', now());
  insert into public.reports (place_id, created_at, place_open, areas, crowd, down_votes)
  values ('cog-hill', '2025-11-29 16:30:00+00', true, '{"range": "good"}', 'quiet', 2);

  -- Tuesday evenings (7 PM Chicago = 01:00 UTC Wednesday): only two.
  insert into public.reports (place_id, created_at, place_open, areas, crowd)
  values ('cog-hill', '2025-11-05 01:00:00+00', true, '{}', 'busy'),
         ('cog-hill', '2025-11-12 01:00:00+00', true, '{}', 'busy');

  perform private.rebuild_place_patterns();
  select * into p from public.place_patterns where place_id = 'cog-hill';

  if p is null then raise exception 'FAIL: no row for cog-hill'; end if;

  if not (p.crowd @> '[{"weekday": 6, "part": "morning", "level": "busy", "count": 4, "total": 5}]') then
    raise exception 'FAIL: Saturday mornings should be packed, 4 of 5 (hidden ones left out): %', p.crowd;
  end if;
  if p.crowd @> '[{"weekday": 2}]' then
    raise exception 'FAIL: 2 Tuesday reports are too few for a pattern: %', p.crowd;
  end if;
  if not (p.areas @> '[{"areaId": "range", "month": 11, "condition": "limited", "count": 3, "total": 4}]') then
    raise exception 'FAIL: the range should be limited in November, 3 of 4: %', p.areas;
  end if;
  if p.areas @> '[{"areaId": "chipping"}]' then
    raise exception 'FAIL: a 2-2 split is not a pattern: %', p.areas;
  end if;
  if p.reports <> 7 then
    raise exception 'FAIL: expected the 7 fixture reports that count, got %', p.reports;
  end if;

  -- Only admins can rebuild through the API.
  begin
    perform set_config('request.jwt.claims', '{"sub": "not-an-admin"}', true);
    perform public.admin_rebuild_patterns();
    raise exception 'FAIL: a non-admin could rebuild the patterns';
  exception when insufficient_privilege then
    null; -- expected
  end;

  raise exception 'place_patterns: all checks passed';
end;
$$;
