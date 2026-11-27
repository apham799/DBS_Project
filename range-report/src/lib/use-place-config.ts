"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDb } from "./db";
import type { ConfirmedRule, HoursRule, Place } from "./types";

// What admins have set in the database: confirmed statuses (place_rules) and
// replacement hours (place_hours). Loaded once per page and kept live, then
// merged into the places from src/data/places.ts with withConfig(), so the
// status logic and every screen see one place, whatever its source.

type RuleRow = { id: string; place_id: string; area_id: string | null; condition: ConfirmedRule["condition"]; note: string; starts_on: string; ends_on: string | null; ended_at: string | null };
type HoursRow = { place_id: string; hours: HoursRule[]; note: string | null; updated_at: string };

export type PlaceConfig = {
  rules: (ConfirmedRule & { placeId: string })[];
  hours: Record<string, { hours: HoursRule[]; note: string | null; updatedAt: string }>;
};

const EMPTY: PlaceConfig = { rules: [], hours: {} };

export function merge(place: Place, config: PlaceConfig): Place {
  const rules = config.rules.filter((r) => r.placeId === place.id);
  const h = config.hours[place.id];
  if (!rules.length && !h) return place;
  return {
    ...place,
    confirmed: rules,
    ...(h ? { hours: h.hours, hoursUpdated: { note: h.note, updatedAt: h.updatedAt } } : {}),
  };
}

export function usePlaceConfig() {
  const { db } = useDb();
  const [config, setConfig] = useState<PlaceConfig>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [r, h] = await Promise.all([
      db.from("place_rules").select("id, place_id, area_id, condition, note, starts_on, ends_on, ended_at").is("ended_at", null),
      db.from("place_hours").select("place_id, hours, note, updated_at"),
    ]);
    if (r.error || h.error) return; // keep what we have; published info still works
    setConfig({
      rules: (r.data as RuleRow[]).map((x) => ({ id: x.id, placeId: x.place_id, areaId: x.area_id, condition: x.condition, note: x.note, startsOn: x.starts_on, endsOn: x.ends_on })),
      hours: Object.fromEntries((h.data as HoursRow[]).map((x) => [x.place_id, { hours: x.hours, note: x.note, updatedAt: x.updated_at }])),
    });
    setLoaded(true);
  }, [db]);

  useEffect(() => {
    const channel = db
      .channel(`place-config-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "place_rules" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "place_hours" }, () => load())
      .subscribe((s) => {
        if (s === "SUBSCRIBED") load();
      });
    // Load anyway if the live connection is slow to open.
    const t = setTimeout(load, 3000);
    return () => {
      clearTimeout(t);
      db.removeChannel(channel);
    };
  }, [db, load]);

  const withConfig = useCallback((p: Place) => merge(p, config), [config]);
  return useMemo(() => ({ config, loaded, withConfig, reload: load }), [config, loaded, withConfig, load]);
}
