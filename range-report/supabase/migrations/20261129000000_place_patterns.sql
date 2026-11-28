-- Nightly patterns: what each place is usually like, from all of its report
-- history (the place page's 30-day summary only sees the last month).
--
--   crowd  per weekday and part of the day (Chicago time): the crowd level
--          most reports agree on, e.g. "usually packed on Saturday mornings"
--   areas  per area and month: the rating most reports agree on, e.g. "short
--          game area usually limited in November"
--
-- A pattern needs at least 3 reports behind it, and at least 60% of them
-- agreeing; otherwise it's left out (a few visits aren't a pattern). Hidden
-- reports (by an admin, or voted down by 2 or more) don't count, the same
-- rule as the app (src/lib/report-visibility.ts).
--
-- The job runs in the database itself (pg_cron), every night at 10:10 UTC
-- (4:10 AM in Chicago in winter, just after the 4 AM "golf day" rollover).
-- Admins can also run it from the Admin page.

create table public.place_patterns (
  place_id    text primary key constraint place_patterns_place_valid check (cardinality(public.place_area_ids(place_id)) > 0),
  crowd       jsonb not null default '[]', -- [{ weekday 0-6 (Sun = 0), part, level, count, total }]
  areas       jsonb not null default '[]', -- [{ areaId, month 1-12, condition, count, total }]
  reports     integer not null,            -- reports that counted, all time
  since       timestamptz,                 -- the first of them
  computed_at timestamptz not null default now()
);

alter table public.place_patterns enable row level security;
grant select on public.place_patterns to anon, authenticated;
create policy "anyone can read patterns" on public.place_patterns for select to anon, authenticated using (true);
-- No insert/update/delete for anyone: only the function below writes.

create function private.rebuild_place_patterns() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_min_reports constant integer := 3;
  v_min_share   constant numeric := 0.6;
  v_places integer;
begin
  -- Rebuilt from scratch in one transaction: readers see the old patterns
  -- until it commits.
  delete from public.place_patterns where true;

  with counted as (
    select r.place_id, r.created_at, r.place_open, r.areas, r.crowd,
           (r.created_at at time zone 'America/Chicago') as local
    from public.reports r
    where r.hidden_at is null and r.down_votes - r.up_votes < 2
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
revoke execute on function private.rebuild_place_patterns() from public, anon, authenticated;

-- "Rebuild now" on the Admin page.
create function public.admin_rebuild_patterns() returns integer
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return private.rebuild_place_patterns();
end;
$$;
revoke execute on function public.admin_rebuild_patterns() from public, anon;
grant execute on function public.admin_rebuild_patterns() to authenticated;

-- The nightly job.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('rebuild-place-patterns', '10 10 * * *', $$select private.rebuild_place_patterns()$$);

-- And once now, so the table isn't empty until tonight.
select private.rebuild_place_patterns();
