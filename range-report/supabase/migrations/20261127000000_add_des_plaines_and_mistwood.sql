-- Two more places (Nov 27, 2026): Golf Center Des Plaines (heated range) and
-- Mistwood Golf Dome (Bolingbrook, indoor). Mirrors src/data/places.ts.
--
-- place_area_ids() becomes the one list of places in the database: the
-- reports check now uses it too, instead of its own copy of the ids, so the
-- next place is a change to this one function.

create or replace function public.place_area_ids(p_place_id text) returns text[]
language sql immutable set search_path = '' as $$
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
    else array[]::text[]
  end;
$$;

alter table public.reports drop constraint reports_place_id_check;
alter table public.reports add constraint reports_place_id_check check (cardinality(public.place_area_ids(place_id)) > 0);
