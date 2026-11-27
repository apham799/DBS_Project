-- Admins, votes, hidden reports, confirmed statuses and admin hours
-- (Nov 28, 2026).
--
--   * Admins: a private list of Clerk user ids. is_admin() tells the app
--     whether the person signed in is one. Every admin action below checks it
--     itself, in the database; the app only decides what to show.
--   * Votes: signed-in golfers vote a report up or down (one vote each, never
--     on their own report). Votes are private; each report carries its counts.
--     The app stops counting a report that's down by 2 or more, but anyone can
--     still choose to see it.
--   * Hidden reports: an admin can hide an abusive report (kept, not deleted),
--     with a reason. Hidden reports don't count, and show only on request.
--   * Confirmed statuses (place_rules): an admin turns what golfers keep
--     reporting into a standing status for a place or one area, e.g. "Range:
--     limited, mats only, through Apr 14". They rank above published seasons;
--     fresh reports still rank above them.
--   * Admin hours (place_hours): an admin replaces a place's published hours.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table private.admins (
  user_id  text primary key,
  added_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.admins where user_id = (select auth.jwt() ->> 'sub'));
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reports: hidden by an admin, and vote counts (written only by the functions
-- below; there are still no update privileges on reports for anyone).
-- ---------------------------------------------------------------------------
alter table public.reports
  add column hidden_at timestamptz,
  add column hidden_reason text constraint reports_hidden_reason_len check (char_length(hidden_reason) <= 200),
  add column up_votes int not null default 0,
  add column down_votes int not null default 0;

create table public.report_votes (
  user_id    text not null default (auth.jwt() ->> 'sub'),
  report_id  uuid not null references public.reports (id) on delete cascade,
  value      smallint not null constraint report_votes_value check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (user_id, report_id)
);
alter table public.report_votes enable row level security;
revoke all on public.report_votes from anon, authenticated;
grant select on public.report_votes to authenticated;
create policy "read own votes" on public.report_votes for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- p_value: 1 up, -1 down, 0 to take your vote back.
create function public.vote_report(p_report_id uuid, p_value smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid text := (select auth.jwt() ->> 'sub');
begin
  if uid is null then
    raise exception 'Sign in to vote' using errcode = '42501';
  end if;
  if p_value not in (-1, 0, 1) then
    raise exception 'A vote is up, down or none' using errcode = '22023';
  end if;
  if not exists (select 1 from public.reports where id = p_report_id) then
    raise exception 'No such report' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.practice_logs where report_id = p_report_id and user_id = uid) then
    raise exception 'You can''t vote on your own report' using errcode = 'RR403';
  end if;

  if p_value = 0 then
    delete from public.report_votes where user_id = uid and report_id = p_report_id;
  else
    insert into public.report_votes (user_id, report_id, value) values (uid, p_report_id, p_value)
    on conflict (user_id, report_id) do update set value = excluded.value, created_at = now();
  end if;

  update public.reports set
    up_votes   = (select count(*) from public.report_votes where report_id = p_report_id and value = 1),
    down_votes = (select count(*) from public.report_votes where report_id = p_report_id and value = -1)
  where id = p_report_id;
end;
$$;
revoke execute on function public.vote_report(uuid, smallint) from public, anon;
grant execute on function public.vote_report(uuid, smallint) to authenticated;

create function public.admin_hide_report(p_report_id uuid, p_hidden boolean, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.reports set
    hidden_at = case when p_hidden then now() end,
    hidden_reason = case when p_hidden then nullif(btrim(p_reason), '') end
  where id = p_report_id;
  if not found then
    raise exception 'No such report' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_hide_report(uuid, boolean, text) from public, anon;
grant execute on function public.admin_hide_report(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Confirmed statuses
-- ---------------------------------------------------------------------------
create table public.place_rules (
  id         uuid primary key default gen_random_uuid(),
  place_id   text not null constraint place_rules_place_valid check (cardinality(public.place_area_ids(place_id)) > 0),
  area_id    text, -- null = the whole place
  condition  text not null constraint place_rules_condition check (condition in ('open', 'limited', 'closed')),
  note       text not null constraint place_rules_note check (char_length(btrim(note)) between 1 and 200),
  starts_on  date not null,
  ends_on    date,
  created_by text not null,
  created_at timestamptz not null default now(),
  ended_at   timestamptz, -- an admin ended it early
  constraint place_rules_area_valid check (area_id is null or area_id = any (public.place_area_ids(place_id))),
  constraint place_rules_dates check (ends_on is null or ends_on >= starts_on)
);
create index place_rules_place_idx on public.place_rules (place_id);
alter table public.place_rules enable row level security;
revoke all on public.place_rules from anon, authenticated;
grant select on public.place_rules to anon, authenticated;
create policy "anyone can read rules" on public.place_rules for select to anon, authenticated using (true);

create function public.admin_set_rule(
  p_place_id text, p_area_id text, p_condition text, p_note text, p_starts_on date, p_ends_on date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  insert into public.place_rules (place_id, area_id, condition, note, starts_on, ends_on, created_by)
  values (p_place_id, nullif(p_area_id, ''), p_condition, btrim(p_note), p_starts_on, p_ends_on, (select auth.jwt() ->> 'sub'))
  returning id into rid;
  return rid;
end;
$$;
revoke execute on function public.admin_set_rule(text, text, text, text, date, date) from public, anon;
grant execute on function public.admin_set_rule(text, text, text, text, date, date) to authenticated;

create function public.admin_end_rule(p_rule_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  update public.place_rules set ended_at = now() where id = p_rule_id and ended_at is null;
  if not found then
    raise exception 'No such rule, or already ended' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.admin_end_rule(uuid) from public, anon;
grant execute on function public.admin_end_rule(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin hours: replaces a place's published hours (same shape as the app's
-- HoursRule[]: [{ "days": [0..6], "open": "HH:MM", "close": "HH:MM" }]).
-- ---------------------------------------------------------------------------
create function public.valid_hours(h jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(h) = 'array'
     and jsonb_array_length(h) between 1 and 14
     and not exists (
       select 1 from jsonb_array_elements(h) r
       where jsonb_typeof(r) <> 'object'
          or jsonb_typeof(r -> 'days') <> 'array'
          or jsonb_array_length(r -> 'days') not between 1 and 7
          or exists (select 1 from jsonb_array_elements(r -> 'days') d where jsonb_typeof(d) <> 'number' or (d #>> '{}')::numeric not in (0, 1, 2, 3, 4, 5, 6))
          or coalesce(r ->> 'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          or coalesce(r ->> 'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     );
$$;

create table public.place_hours (
  place_id   text primary key constraint place_hours_place_valid check (cardinality(public.place_area_ids(place_id)) > 0),
  hours      jsonb not null constraint place_hours_valid check (public.valid_hours(hours)),
  note       text constraint place_hours_note check (char_length(note) <= 300),
  updated_by text not null,
  updated_at timestamptz not null default now()
);
alter table public.place_hours enable row level security;
revoke all on public.place_hours from anon, authenticated;
grant select on public.place_hours to anon, authenticated;
create policy "anyone can read hours" on public.place_hours for select to anon, authenticated using (true);

create function public.admin_set_hours(p_place_id text, p_hours jsonb, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  insert into public.place_hours (place_id, hours, note, updated_by)
  values (p_place_id, p_hours, nullif(btrim(p_note), ''), (select auth.jwt() ->> 'sub'))
  on conflict (place_id) do update set hours = excluded.hours, note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
end;
$$;
revoke execute on function public.admin_set_hours(text, jsonb, text) from public, anon;
grant execute on function public.admin_set_hours(text, jsonb, text) to authenticated;

-- Back to the published hours.
create function public.admin_clear_hours(p_place_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  delete from public.place_hours where place_id = p_place_id;
end;
$$;
revoke execute on function public.admin_clear_hours(text) from public, anon;
grant execute on function public.admin_clear_hours(text) to authenticated;

-- Live: vote counts and hiding change existing reports; rules and hours change
-- what every open page shows.
alter publication supabase_realtime add table public.place_rules, public.place_hours;
