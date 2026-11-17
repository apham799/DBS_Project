-- Harden posting (from a review of the v1 systems code).
--
-- Before: signed-in users could also INSERT into reports directly (skipping
-- post_report, so no practice log tied the report to anyone), delete their
-- logs afterwards, post as often as they liked, and send area names a place
-- doesn't have. One account could keep any place "closed" all day.
--
-- After:
--   * post_report() is the only way in. It runs as its owner (security
--     definer) and does every check itself; the table privileges for
--     inserting reports/logs and deleting logs are gone.
--   * At most one report per place every 10 minutes per person, and 20 a day.
--   * Area names must belong to the place; at most 8 per report.
--   * Crowd is only kept when the place was open.
--   * The app sends its own report id, so a retry after a lost response
--     returns the same report instead of posting a duplicate.
--   * The "no links" rule also catches bare domains (example.com/x).

-- ---------------------------------------------------------------------------
-- Which areas each place has (mirrors src/data/places.ts; a new place or area
-- needs a migration, as the place_id check already did).
-- ---------------------------------------------------------------------------
create function public.place_area_ids(p_place_id text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_place_id
    when 'harborside'                  then array['range', 'chipping', 'bunker', 'putting']
    when 'jackson-park'                then array['range', 'chipping', 'putting']
    when 'diversey'                    then array['range', 'bays', 'putting']
    when 'cog-hill'                    then array['range', 'bays', 'chipping', 'bunker', 'putting']
    when 'pga-superstore-lincoln-park' then array['bays', 'putting']
    when 'five-iron-bucktown'          then array['bays']
    when 'parennial-lincoln-park'      then array['bays', 'putting']
    else array[]::text[]
  end;
$$;

-- areas: also cap the number of keys, so no report can bloat every page load.
create or replace function public.valid_areas(a jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(a) = 'object'
     and (select count(*) from jsonb_object_keys(a)) <= 8
     and not exists (
       select 1 from jsonb_each(a) e
       where jsonb_typeof(e.value) <> 'string'
          or (e.value #>> '{}') not in ('good', 'limited', 'closed')
          or e.key !~ '^[a-z-]{1,30}$'
     );
$$;

-- Place ids on logs and follows are checked too (follows were unbounded text).
alter table public.practice_logs add constraint practice_logs_place_valid check (cardinality(public.place_area_ids(place_id)) > 0);
alter table public.follows       add constraint follows_place_valid       check (cardinality(public.place_area_ids(place_id)) > 0);

-- Links in public notes: http(s)://, www., or a bare domain like example.com.
alter table public.reports drop constraint reports_note_valid;
alter table public.reports add constraint reports_note_valid check (
  note is null
  or (
    char_length(note) between 1 and 280
    and note !~* '(https?://|www\.)'
    and note !~* '[a-z0-9-]+\.(com|net|org|io|co|ly|gg|me|xyz|info|biz|app|dev|link|site|shop|club|us|tv|to)(\M|/)'
  )
);

-- ---------------------------------------------------------------------------
-- Only post_report() writes reports and logs.
-- ---------------------------------------------------------------------------
revoke insert on public.reports from authenticated;
drop policy "signed in can add reports" on public.reports;

revoke insert, delete on public.practice_logs from authenticated;
drop policy "add own logs" on public.practice_logs;
drop policy "remove own logs" on public.practice_logs;

drop function public.post_report(text, boolean, jsonb, text, text, text, text);

create function public.post_report(
  p_place_id text,
  p_place_open boolean,
  p_areas jsonb,
  p_crowd text,
  p_note text,
  p_changed_decision text,
  p_public_note text default null,
  p_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid text := (select auth.jwt() ->> 'sub');
  rid uuid := coalesce(p_id, gen_random_uuid());
  v_areas jsonb := case when p_place_open then coalesce(p_areas, '{}') else '{}' end;
begin
  if uid is null then
    raise exception 'Sign in to post a report' using errcode = '42501';
  end if;

  -- A retry of a post that already went through: same answer, no duplicate.
  if p_id is not null and exists (select 1 from public.reports where id = p_id) then
    if exists (select 1 from public.practice_logs where report_id = p_id and user_id = uid) then
      return p_id;
    end if;
    raise exception 'That report id is taken' using errcode = '23505';
  end if;

  if cardinality(public.place_area_ids(p_place_id)) = 0 then
    raise exception 'Unknown place' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_object_keys(v_areas) k where not (k = any (public.place_area_ids(p_place_id)))) then
    raise exception 'That place has no such area' using errcode = '23514';
  end if;

  -- Rate limits. RR429 lets the app show a friendly message.
  if exists (
    select 1 from public.practice_logs
    where user_id = uid and place_id = p_place_id and created_at > now() - interval '10 minutes'
  ) then
    raise exception 'You posted here a few minutes ago' using errcode = 'RR429';
  end if;
  if (select count(*) from public.practice_logs where user_id = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s a lot of reports for one day' using errcode = 'RR429';
  end if;

  insert into public.reports (id, place_id, place_open, areas, crowd, note)
  values (rid, p_place_id, p_place_open, v_areas, case when p_place_open then p_crowd end, nullif(btrim(p_public_note), ''));

  insert into public.practice_logs (user_id, report_id, place_id, note, changed_decision)
  values (uid, rid, p_place_id, nullif(btrim(p_note), ''), p_changed_decision);

  return rid;
end;
$$;

revoke execute on function public.post_report(text, boolean, jsonb, text, text, text, text, uuid) from public, anon;
grant execute on function public.post_report(text, boolean, jsonb, text, text, text, text, uuid) to authenticated;
