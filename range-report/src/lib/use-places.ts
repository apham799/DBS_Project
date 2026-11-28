"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { places as builtIn } from "@/data/places";
import { ADDED_PLACE_FIELDS, toPlace, type AddedPlaceRow } from "./added-places";
import { useDb } from "./db";
import type { Place } from "./types";

// Every place this person can use: the built-in ones (src/data/places.ts),
// approved places golfers asked for, and their own requests still waiting
// (or not added), which only they can see. Kept live, so an approval shows
// up without a reload. Admins can read everyone's requests, but those belong
// on the Admin page, not in their lists, so only "mine" are kept here.
export function useAddedPlaces() {
  const { db, userId } = useDb();
  const [state, setState] = useState<{ key: string; places: Place[] } | null>(null);
  const key = userId ?? "guest";

  const load = useCallback(async () => {
    const [rows, mine] = await Promise.all([
      db.from("added_places").select(ADDED_PLACE_FIELDS).order("created_at"),
      userId ? db.rpc("my_place_requests") : Promise.resolve({ data: [] as string[], error: null }),
    ]);
    if (rows.error) return; // the built-in places still work
    const ids = new Set(((mine.data ?? []) as string[]).map(String));
    const places = (rows.data as AddedPlaceRow[])
      .filter((r) => r.status === "approved" || ids.has(r.id))
      .map((r) => toPlace(r, ids.has(r.id)));
    setState({ key, places });
  }, [db, userId, key]);

  useEffect(() => {
    const channel = db
      .channel(`added-places-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "added_places" }, () => load())
      .subscribe();
    const t = setTimeout(load, 0);
    return () => {
      clearTimeout(t);
      db.removeChannel(channel);
    };
  }, [db, load]);

  const current = state?.key === key ? state : null;
  return { added: current?.places ?? [], loaded: current !== null, reload: load };
}

export function usePlaces() {
  const { added, loaded, reload } = useAddedPlaces();
  const places = useMemo(() => [...builtIn, ...added], [added]);
  const byId = useCallback((id: string) => places.find((p) => p.id === id), [places]);
  return { places, byId, loaded, reload };
}
