"use client";

import { useCallback, useEffect, useState } from "react";
import { useDb } from "./db";
import { needsOlder, rangeStart, type ReportRange } from "./report-range";
import type { Report } from "./types";
import { toReport, type ReportRow } from "./use-reports";

const MAX = 1000;

// One place's reports for "Past year" / "All time" on its page, loaded when
// picked (the app only keeps the last 30 days live). The page merges these
// with the live ones, so a report posted meanwhile still shows at once.
export function useOlderReports(placeId: string, range: ReportRange) {
  const { db } = useDb();
  const [state, setState] = useState<{ key: string; reports: Report[]; capped: boolean } | null>(null);
  const key = `${placeId}:${range}`;
  const wanted = needsOlder(range);

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    let q = db
      .from("reports")
      .select("id, place_id, created_at, place_open, areas, crowd, note, source, hidden_at, hidden_reason, up_votes, down_votes")
      .eq("place_id", placeId);
    const start = rangeStart(range, new Date());
    if (start !== null) q = q.gte("created_at", new Date(start).toISOString());
    q.order("created_at", { ascending: false })
      .limit(MAX)
      .then(({ data, error }) => {
        if (cancelled) return;
        const reports = error ? [] : (data as ReportRow[]).map(toReport);
        setState({ key, reports, capped: reports.length === MAX });
      });
    return () => {
      cancelled = true;
    };
  }, [db, placeId, range, wanted, key]);

  // After a vote or an admin hiding one of these, show its new counts.
  const update = useCallback((r: Report) => {
    setState((s) => (s ? { ...s, reports: s.reports.map((x) => (x.id === r.id ? r : x)) } : s));
  }, []);

  const current = state?.key === key ? state : null;
  return { reports: current?.reports ?? [], loading: wanted && !current, capped: current?.capped ?? false, update };
}
