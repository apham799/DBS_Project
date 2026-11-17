-- Range Report: reports, practice logs, follows.
--
-- Places are reference data in the code (src/data/places.ts); place_id here is
-- checked against that list, so a new place needs a migration too.
--
-- Privacy by design:
--   reports        public to read (guests too), with NO user id in them at all.
--                  Never edited or deleted: past reports are the history.
--   practice_logs  private: each person sees only their own. A log is what
--                  links a person to a report they posted.
--   follows        private: each person sees only their own.
--
-- Posting goes through post_report(), which writes the report and its log in
-- one transaction, so there's never a report without its author's log.

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  place_id    text not null check (place_id in (
                'harborside', 'jackson-park', 'diversey', 'cog-hill',
                'pga-superstore-lincoln-park', 'five-iron-bucktown', 'parennial-lincoln-park')),
  created_at  timestamptz not null default now(),
  place_open  boolean not null,                   -- false = "it was closed when I got there"
  areas       jsonb not null default '{}',        -- { "chipping": "closed", "range": "good" }
  crowd       text check (crowd in ('quiet', 'some_wait', 'busy'))
);

create index reports_place_created_idx on public.reports (place_id, created_at desc);

-- areas must be an object of area id → good | limited | closed.
create function public.valid_areas(a jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(a) = 'object'
     and not exists (
       select 1 from jsonb_each(a) e
       where jsonb_typeof(e.value) <> 'string'
          or (e.value #>> '{}') not in ('good', 'limited', 'closed')
          or e.key !~ '^[a-z-]{1,30}$'
     );
$$;
alter table public.reports add constraint reports_areas_valid check (public.valid_areas(areas));

create table public.practice_logs (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null default (auth.jwt() ->> 'sub'),
  report_id         uuid unique references public.reports (id),
  place_id          text not null,
  created_at        timestamptz not null default now(),
  note              text check (char_length(note) <= 500),
  -- "Did the reports change anything?" (null = didn't answer)
  changed_decision  text check (changed_decision in ('time', 'place', 'plan', 'packed', 'no'))
);

create index practice_logs_user_created_idx on public.practice_logs (user_id, created_at desc);

create table public.follows (
  user_id     text not null default (auth.jwt() ->> 'sub'),
  place_id    text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.reports       enable row level security;
alter table public.practice_logs enable row level security;
alter table public.follows       enable row level security;

-- Reports: anyone can read. Only signed-in people can add, and only through
-- post_report() in practice (there's no update or delete policy for anyone).
create policy "anyone can read reports" on public.reports
  for select to anon, authenticated using (true);
create policy "signed in can add reports" on public.reports
  for insert to authenticated with check ((select auth.jwt() ->> 'sub') is not null);

-- Logs: your own only.
create policy "read own logs"   on public.practice_logs for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "add own logs"    on public.practice_logs for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "remove own logs" on public.practice_logs for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- Follows: your own only.
create policy "read own follows"   on public.follows for select to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
create policy "add own follows"    on public.follows for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);
create policy "remove own follows" on public.follows for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- ---------------------------------------------------------------------------
-- Grants. Supabase's defaults give every role every privilege on new tables;
-- RLS doesn't cover TRUNCATE or TRIGGER, so take it all away and grant back
-- only what the app uses (lesson from Assignment 5).
-- ---------------------------------------------------------------------------
revoke all on public.reports, public.practice_logs, public.follows from anon, authenticated;
grant select on public.reports to anon, authenticated;
grant insert (place_id, place_open, areas, crowd) on public.reports to authenticated;
-- Column-level inserts: ids, owners and timestamps always come from defaults,
-- so nobody can backdate a report or file one under someone else.
grant select, delete on public.practice_logs to authenticated;
grant insert (report_id, place_id, note, changed_decision) on public.practice_logs to authenticated;
grant select, delete on public.follows to authenticated;
grant insert (place_id) on public.follows to authenticated;

-- ---------------------------------------------------------------------------
-- post_report: the one way the app posts. Runs as the caller (security
-- invoker), so RLS still applies to both inserts.
-- ---------------------------------------------------------------------------
create function public.post_report(
  p_place_id text,
  p_place_open boolean,
  p_areas jsonb,
  p_crowd text,
  p_note text,
  p_changed_decision text
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  rid uuid;
begin
  if (select auth.jwt() ->> 'sub') is null then
    raise exception 'Sign in to post a report';
  end if;

  insert into public.reports (place_id, place_open, areas, crowd)
  values (p_place_id, p_place_open, case when p_place_open then coalesce(p_areas, '{}') else '{}' end, p_crowd)
  returning id into rid;

  insert into public.practice_logs (report_id, place_id, note, changed_decision)
  values (rid, p_place_id, nullif(btrim(p_note), ''), p_changed_decision);

  return rid;
end;
$$;

revoke execute on function public.post_report(text, boolean, jsonb, text, text, text) from public, anon;
grant execute on function public.post_report(text, boolean, jsonb, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: new reports reach open pages, guests included (same grants + RLS).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.reports;
