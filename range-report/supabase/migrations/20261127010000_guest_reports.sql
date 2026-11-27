-- Guest reports (Nov 27, 2026, decided after the v1 feedback): anyone can post
-- without an account. Signing in is offered (for a private log and follows),
-- not required. Guest reports are marked, so people can filter them out.
--
-- Without an account the only thing to limit by is the device, so:
--   * The device is a salted SHA-256 hash of its IP address, taken from the
--     cf-connecting-ip header (set by Cloudflare in front of Supabase, so a
--     browser can't fake it). The IP itself is never stored.
--   * Hashes live in a private schema the API doesn't expose, and are deleted
--     after a day. They link a report to a device only for that day, only for
--     rate limiting and safe retries.
--   * Limits: one guest report per place every 10 minutes per device, 10 a
--     day per device, and at most 6 guest reports per place per hour overall
--     (so switching networks can't flood one place).
--   * Guest reports get no practice log (there's no one to give it to).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.settings (key text primary key, value text not null);
insert into private.settings (key, value) values ('guest_salt', encode(extensions.gen_random_bytes(32), 'hex'));

create table private.guest_posts (
  report_id  uuid primary key references public.reports (id) on delete cascade,
  device     text not null,
  place_id   text not null,
  created_at timestamptz not null default now()
);
create index guest_posts_device_idx on private.guest_posts (device, created_at desc);
create index guest_posts_place_idx  on private.guest_posts (place_id, created_at desc);

alter table public.reports
  add column source text not null default 'account'
  constraint reports_source_valid check (source in ('account', 'guest'));

create function public.post_guest_report(
  p_place_id text,
  p_place_open boolean,
  p_areas jsonb,
  p_crowd text,
  p_public_note text default null,
  p_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  headers jsonb := coalesce(current_setting('request.headers', true), '{}')::jsonb;
  ip text := coalesce(nullif(headers ->> 'cf-connecting-ip', ''), nullif(btrim(split_part(headers ->> 'x-forwarded-for', ',', 1)), ''));
  v_device text;
  rid uuid := coalesce(p_id, gen_random_uuid());
  v_areas jsonb := case when p_place_open then coalesce(p_areas, '{}') else '{}' end;
begin
  if ip is null then
    raise exception 'Could not post as a guest from here' using errcode = '42501';
  end if;
  v_device := encode(extensions.digest(ip || (select value from private.settings where key = 'guest_salt'), 'sha256'), 'hex');

  -- Forget devices after a day.
  delete from private.guest_posts where created_at < now() - interval '1 day';

  -- A retry of a post that already went through: same answer, no duplicate.
  if p_id is not null and exists (select 1 from public.reports where id = p_id) then
    if exists (select 1 from private.guest_posts where report_id = p_id and device = v_device) then
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

  if exists (select 1 from private.guest_posts where device = v_device and place_id = p_place_id and created_at > now() - interval '10 minutes') then
    raise exception 'You posted here a few minutes ago' using errcode = 'RR429';
  end if;
  if (select count(*) from private.guest_posts where device = v_device) >= 10 then
    raise exception 'That''s a lot of guest reports for one day' using errcode = 'RR429';
  end if;
  if (select count(*) from private.guest_posts where place_id = p_place_id and created_at > now() - interval '1 hour') >= 6 then
    raise exception 'Lots of guest reports here this hour; sign in to post' using errcode = 'RR430';
  end if;

  insert into public.reports (id, place_id, place_open, areas, crowd, note, source)
  values (rid, p_place_id, p_place_open, v_areas, case when p_place_open then p_crowd end, nullif(btrim(p_public_note), ''), 'guest');

  insert into private.guest_posts (report_id, device, place_id) values (rid, v_device, p_place_id);

  return rid;
end;
$$;

-- Guests only: signed-in golfers post with post_report(), which keeps their log.
revoke execute on function public.post_guest_report(text, boolean, jsonb, text, text, uuid) from public, authenticated;
grant execute on function public.post_guest_report(text, boolean, jsonb, text, text, uuid) to anon;
