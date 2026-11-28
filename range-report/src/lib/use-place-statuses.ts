"use client";

import { useMemo } from "react";
import { places as basePlaces } from "@/data/places";
import { bySource } from "./report-source";
import { counts } from "./report-visibility";
import { effectiveNow, placeStatus, type PlaceStatus } from "./status";
import { usePlaceConfig } from "./use-place-config";
import { useReportSource } from "./use-report-source";
import { useReports } from "./use-reports";
import { useNow, useWeather } from "./use-weather";

// Every place's status right now, the way Home shows it: the places with what
// admins have set merged in, the reports that count as "Reports from" says,
// and the weather. Home and the city map both use this, so a pin and a card
// never disagree.
export function usePlaceStatuses() {
  const { reports: allReports, loaded, error, live, justAdded, retry } = useReports();
  const source = useReportSource();
  const reports = useMemo(() => bySource(allReports, source).filter(counts), [allReports, source]);
  const weather = useWeather();
  const { withConfig } = usePlaceConfig();
  const places = useMemo(() => basePlaces.map(withConfig), [withConfig]);
  const clock = useNow();
  // Never behind the newest report (a slow device clock would hide it).
  const now = useMemo(() => clock && effectiveNow(clock, reports), [clock, reports]);

  const statuses = useMemo<Record<string, PlaceStatus> | null>(
    () =>
      now &&
      Object.fromEntries(
        places.map((p) => [p.id, placeStatus(p, reports, now, weather.status === "ok" ? { stormNow: !!weather.byPlace[p.id]?.stormNow } : null)]),
      ),
    [places, reports, now, weather],
  );

  return { places, statuses, reports, now, weather, loaded, error, live, justAdded, retry };
}
