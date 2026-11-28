"use client";

import { useEffect, useState } from "react";
import { useDb } from "./db";
import type { PlacePatterns } from "./patterns";

type Row = { place_id: string; crowd: PlacePatterns["crowd"]; areas: PlacePatterns["areas"]; reports: number; since: string | null; computed_at: string };

export const toPatterns = (r: Row): PlacePatterns => ({ placeId: r.place_id, crowd: r.crowd, areas: r.areas, reports: r.reports, since: r.since, computedAt: r.computed_at });

// A place's patterns from the nightly job, read once per page (they change
// once a night). null until loaded, and when the place has no reports yet.
export function usePlacePatterns(placeId: string): PlacePatterns | null {
  const { db } = useDb();
  const [result, setResult] = useState<{ placeId: string; patterns: PlacePatterns | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    db.from("place_patterns")
      .select("place_id, crowd, areas, reports, since, computed_at")
      .eq("place_id", placeId)
      .maybeSingle()
      .then(({ data }) => !cancelled && setResult({ placeId, patterns: data ? toPatterns(data as Row) : null }));
    return () => {
      cancelled = true;
    };
  }, [db, placeId]);

  return result?.placeId === placeId ? result.patterns : null;
}
