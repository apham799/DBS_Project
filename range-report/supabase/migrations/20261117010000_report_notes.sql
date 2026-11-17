-- A public note on each report ("chipping green roped off, use the side
-- putting green"). Optional, short, and shown to everyone, still with no name.
-- The private note in practice_logs stays as it was: that one is just for you.
--
-- Free text from anonymous golfers is public, so the database keeps it small:
-- 280 characters, no links (the easiest kind of spam). Reports still can't be
-- edited or deleted by anyone in the app; the project owner can remove one
-- from the Supabase dashboard if it's abusive.

alter table public.reports
  add column note text
  constraint reports_note_valid check (
    note is null
    or (char_length(note) between 1 and 280 and note !~* '(https?://|www\.)')
  );

grant insert (note) on public.reports to authenticated;

-- post_report gains p_public_note. It has a default, so the app version that's
-- already deployed (which doesn't send it) keeps working during the rollout.
drop function public.post_report(text, boolean, jsonb, text, text, text);

create function public.post_report(
  p_place_id text,
  p_place_open boolean,
  p_areas jsonb,
  p_crowd text,
  p_note text,
  p_changed_decision text,
  p_public_note text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  rid uuid;
begin
  if (select auth.jwt() ->> 'sub') is null then
    raise exception 'Sign in to post a report';
  end if;

  insert into public.reports (place_id, place_open, areas, crowd, note)
  values (
    p_place_id,
    p_place_open,
    case when p_place_open then coalesce(p_areas, '{}') else '{}' end,
    p_crowd,
    nullif(btrim(p_public_note), '')
  )
  returning id into rid;

  insert into public.practice_logs (report_id, place_id, note, changed_decision)
  values (rid, p_place_id, nullif(btrim(p_note), ''), p_changed_decision);

  return rid;
end;
$$;

revoke execute on function public.post_report(text, boolean, jsonb, text, text, text, text) from public, anon;
grant execute on function public.post_report(text, boolean, jsonb, text, text, text, text) to authenticated;
