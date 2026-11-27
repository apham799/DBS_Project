"use client";

import { useMemo } from "react";
import { places as basePlaces } from "@/data/places";
import { counts } from "./report-visibility";
import { effectiveNow } from "./status";
import { suggestionsFor, type Suggestion } from "./suggestions";
import type { Place } from "./types";
import { useDismissed } from "./use-dismissed";
import { usePlaceConfig } from "./use-place-config";
import { useReports } from "./use-reports";
import { useNow } from "./use-weather";

export type PlaceSuggestions = { place: Place; suggestions: Suggestion[] };

// Every place's suggestions from golfers' reports, minus the dismissed ones:
// the Admin page and the count on its tab. Like the place pages, it looks at
// every report that counts, whatever "Reports from" says.
export function useAllSuggestions() {
  const { reports: all, loaded: reportsLoaded, error } = useReports();
  const { withConfig, loaded: configLoaded, reload } = usePlaceConfig();
  const { isDismissed, dismiss } = useDismissed();
  const clock = useNow();

  const reports = useMemo(() => all.filter(counts), [all]);
  const now = useMemo(() => clock && effectiveNow(clock, reports), [clock, reports]);
  const loaded = reportsLoaded && configLoaded && !!now;

  const groups = useMemo<PlaceSuggestions[]>(() => {
    if (!loaded || !now) return [];
    return basePlaces
      .map(withConfig)
      .map((place) => ({ place, suggestions: suggestionsFor(place, reports, now).filter((s) => !isDismissed(place.id, s.key)) }))
      .filter((g) => g.suggestions.length > 0);
  }, [loaded, now, withConfig, reports, isDismissed]);

  const total = groups.reduce((n, g) => n + g.suggestions.length, 0);
  return { groups, total, loaded, error, now, dismiss, reload };
}
