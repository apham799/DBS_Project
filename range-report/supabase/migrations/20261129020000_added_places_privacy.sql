-- Who asked for a place is never readable through the API, even once the
-- place is approved and public (reports don't carry user ids either). The
-- row filter still uses it; only the column is closed. my_place_requests()
-- tells you which requests are yours.

revoke select on public.added_places from anon, authenticated;
grant select (id, name, neighborhood, address, lat, lon, kind, areas, hours, hours_note, website, status, admin_note, created_at, decided_at)
  on public.added_places to anon, authenticated;

create function public.my_place_requests() returns setof text
language sql stable security definer set search_path = '' as $$
  select id from public.added_places where requested_by = (select auth.jwt() ->> 'sub');
$$;
revoke execute on function public.my_place_requests() from public, anon;
grant execute on function public.my_place_requests() to authenticated;
