-- Places golfers ask for (outside Chicago, or just missing). A signed-in golfer
-- requests one; an admin approves it or not.
--
--   pending   only the golfer who asked can see it, post there, and read its
--   rejected  reports (admins see the request itself, to review it, but not
--             the reports). A rejected place stays usable for that golfer.
--   approved  a place like any other, for everyone.
--
-- "Only them" is enforced here, not in the app: reports are readable only at
-- places you can see (place_visible), and a trigger stops a report at a place
-- you can't see, whichever function posts it. When a place is approved, its
-- reports become public like any other (the request form says so).

-- What an added place's areas look like: 1 to 5 of the kinds the app draws,
-- each once, with a short label: [{ "id": "range", "kind": "range", "label": "Driving range", "outdoor": true }]
create function public.valid_place_areas(a jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(a) = 'array'
     and jsonb_array_length(a) between 1 and 5
     and not exists (
       select 1 from jsonb_array_elements(a) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e ->> 'id', '') not in ('range', 'bays', 'chipping', 'bunker', 'putting')
          or e ->> 'kind' is distinct from e ->> 'id'
          or char_length(btrim(coalesce(e ->> 'label', ''))) not between 1 and 40
          or jsonb_typeof(e -> 'outdoor') <> 'boolean'
     )
     and (select count(distinct e ->> 'id') from jsonb_array_elements(a) e) = jsonb_array_length(a);
$$;

create table public.added_places (
  id           text primary key default ('added-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  requested_by text not null,
  name         text not null constraint added_places_name check (char_length(btrim(name)) between 3 and 80),
  neighborhood text not null constraint added_places_neighborhood check (char_length(btrim(neighborhood)) between 2 and 60),
  address      text not null default '' constraint added_places_address check (char_length(address) <= 160),
  lat          double precision not null constraint added_places_lat check (lat between -90 and 90),
  lon          double precision not null constraint added_places_lon check (lon between -180 and 180),
  kind         text not null constraint added_places_kind check (kind in ('walk_in', 'sim')),
  areas        jsonb not null constraint added_places_areas check (public.valid_place_areas(areas)),
  hours        jsonb not null constraint added_places_hours check (hours = '"24/7"'::jsonb or public.valid_hours(hours)),
  hours_note   text not null default '' constraint added_places_hours_note check (char_length(hours_note) <= 200),
  website      text not null default '' constraint added_places_website check (website = '' or website ~ '^https?://[^[:space:]]{3,200}$'),
  status       text not null default 'pending' constraint added_places_status check (status in ('pending', 'approved', 'rejected')),
  admin_note   text constraint added_places_admin_note check (char_length(admin_note) <= 200),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create index added_places_requested_by_idx on public.added_places (requested_by);

alter table public.added_places enable row level security;
grant select on public.added_places to anon, authenticated;
create policy "approved places, your own requests, and admins" on public.added_places for select to anon, authenticated
  using (status = 'approved' or requested_by = (select auth.jwt() ->> 'sub') or (select public.is_admin()));
-- No insert/update/delete for anyone: request_place() and admin_decide_place() below.

-- The one list of places now includes added ones (any status: whether you may
-- see one is place_visible's job). Security definer, so the checks that use it
-- see every place whoever is asking.
create or replace function public.place_area_ids(p_place_id text) returns text[]
language sql stable security definer set search_path = '' as $$
  select case p_place_id
    when 'harborside'                  then array['range', 'chipping', 'bunker', 'putting']
    when 'jackson-park'                then array['range', 'chipping', 'putting']
    when 'diversey'                    then array['range', 'bays', 'putting']
    when 'cog-hill'                    then array['range', 'bays', 'chipping', 'bunker', 'putting']
    when 'golf-center-des-plaines'     then array['bays', 'range', 'chipping', 'bunker']
    when 'mistwood-golf-dome'          then array['bays', 'chipping', 'putting']
    when 'pga-superstore-lincoln-park' then array['bays', 'putting']
    when 'five-iron-bucktown'          then array['bays']
    when 'parennial-lincoln-park'      then array['bays', 'putting']
    else coalesce(
      (select array(select e ->> 'id' from jsonb_array_elements(ap.areas) e) from public.added_places ap where ap.id = p_place_id),
      array[]::text[])
  end;
$$;

-- Whether the person asking may see a place (and its reports): every place,
-- except someone else's added place that isn't approved.
create function public.place_visible(p_place_id text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.added_places ap
    where ap.id = p_place_id and ap.status <> 'approved'
      and ap.requested_by is distinct from (select auth.jwt() ->> 'sub')
  );
$$;
revoke execute on function public.place_visible(text) from public;
grant execute on function public.place_visible(text) to anon, authenticated;

drop policy "anyone can read reports" on public.reports;
create policy "read reports at places you can see" on public.reports for select to anon, authenticated
  using ((select public.place_visible(place_id)));

-- Whichever function posts a report (signed in or guest), not at a place you can't see.
create function private.check_report_place() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.place_visible(new.place_id) then
    raise exception 'Unknown place' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger reports_place_visible before insert on public.reports
  for each row execute function private.check_report_place();

-- Ask for a place. At most 3 waiting at once, and 5 requests a day.
create function public.request_place(
  p_name text, p_neighborhood text, p_address text, p_lat double precision, p_lon double precision,
  p_kind text, p_areas jsonb, p_hours jsonb, p_hours_note text, p_website text
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid text := (select auth.jwt() ->> 'sub');
  new_id text;
begin
  if uid is null then
    raise exception 'Sign in to request a place' using errcode = '42501';
  end if;
  if (select count(*) from public.added_places where requested_by = uid and status = 'pending') >= 3 then
    raise exception 'You have 3 places waiting for review already' using errcode = 'RR429';
  end if;
  if (select count(*) from public.added_places where requested_by = uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s a lot of requests for one day' using errcode = 'RR429';
  end if;
  insert into public.added_places (requested_by, name, neighborhood, address, lat, lon, kind, areas, hours, hours_note, website)
  values (uid, btrim(p_name), btrim(p_neighborhood), btrim(coalesce(p_address, '')), p_lat, p_lon, p_kind, p_areas, p_hours,
          btrim(coalesce(p_hours_note, '')), btrim(coalesce(p_website, '')))
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.request_place(text, text, text, double precision, double precision, text, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.request_place(text, text, text, double precision, double precision, text, jsonb, jsonb, text, text) to authenticated;

-- An admin approves a request (it becomes a place for everyone) or doesn't
-- (it stays private to the golfer who asked, with the admin's note).
create function public.admin_decide_place(p_id text, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.added_places
  set status = case when p_approve then 'approved' else 'rejected' end,
      admin_note = nullif(btrim(coalesce(p_note, '')), ''),
      decided_at = now()
  where id = p_id;
  if not found then
    raise exception 'No such request' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_decide_place(text, boolean, text) from public, anon;
grant execute on function public.admin_decide_place(text, boolean, text) to authenticated;

-- Live: a request appears for admins, and a decision reaches the golfer who asked.
alter publication supabase_realtime add table public.added_places;

-- Patterns (shared with everyone) only from places everyone can see.
create or replace function private.rebuild_place_patterns() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_min_reports constant integer := 3;
  v_min_share   constant numeric := 0.6;
  v_places integer;
begin
  delete from public.place_patterns where true;

  with counted as (
    select r.place_id, r.created_at, r.place_open, r.areas, r.crowd,
           (r.created_at at time zone 'America/Chicago') as local
    from public.reports r
    where r.hidden_at is null and r.down_votes - r.up_votes < 2
      and not exists (select 1 from public.added_places ap where ap.id = r.place_id and ap.status <> 'approved')
  ),
  slots as (
    select place_id,
           extract(dow from local)::int as weekday,
           case when extract(hour from local) < 12 then 'morning'
                when extract(hour from local) < 17 then 'afternoon'
                else 'evening' end as part,
           crowd
    from counted
    where place_open and crowd is not null
  ),
  slot_levels as (
    select place_id, weekday, part, crowd as level, count(*)::int as n,
           sum(count(*)) over (partition by place_id, weekday, part)::int as total
    from slots group by place_id, weekday, part, crowd
  ),
  crowd_patterns as (
    select place_id,
           jsonb_agg(jsonb_build_object('weekday', weekday, 'part', part, 'level', level, 'count', n, 'total', total)
                     order by n desc, total desc, weekday, part) as crowd
    from slot_levels
    where total >= v_min_reports and n >= v_min_share * total
    group by place_id
  ),
  ratings as (
    select c.place_id, extract(month from c.local)::int as month, a.key as area_id, a.value #>> '{}' as condition
    from counted c, jsonb_each(c.areas) a
    where c.place_open
  ),
  area_levels as (
    select place_id, area_id, month, condition, count(*)::int as n,
           sum(count(*)) over (partition by place_id, area_id, month)::int as total
    from ratings group by place_id, area_id, month, condition
  ),
  area_patterns as (
    select place_id,
           jsonb_agg(jsonb_build_object('areaId', area_id, 'month', month, 'condition', condition, 'count', n, 'total', total)
                     order by month, area_id) as areas
    from area_levels
    where total >= v_min_reports and n >= v_min_share * total
    group by place_id
  ),
  places as (
    select place_id, count(*)::int as reports, min(created_at) as since from counted group by place_id
  )
  insert into public.place_patterns (place_id, crowd, areas, reports, since, computed_at)
  select p.place_id, coalesce(cp.crowd, '[]'), coalesce(ap.areas, '[]'), p.reports, p.since, now()
  from places p
  left join crowd_patterns cp using (place_id)
  left join area_patterns ap using (place_id);

  get diagnostics v_places = row_count;
  return v_places;
end;
$$;
