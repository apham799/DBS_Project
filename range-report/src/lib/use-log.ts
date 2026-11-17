"use client";

import { useEffect, useState } from "react";
import { useDb } from "./db";
import type { Condition, Crowd, Report } from "./types";

// The signed-in golfer's own practice log: every session they posted, newest
// first, with the report it went with. Row-level security returns only their
// own rows (tested with two users); the app never filters by user id itself.

export type Changed = "time" | "place" | "plan" | "packed" | "no";

export type LogEntry = {
  id: string;
  placeId: string;
  createdAt: string;
  note: string | null; // private
  changed: Changed | null;
  report: Report | null;
};

type ReportRow = { id: string; place_id: string; created_at: string; place_open: boolean; areas: Record<string, Condition>; crowd: Crowd | null; note: string | null };
type Row = { id: string; place_id: string; created_at: string; note: string | null; changed_decision: Changed | null; report: ReportRow | ReportRow[] | null };

const toEntry = (r: Row): LogEntry => {
  const rep = Array.isArray(r.report) ? r.report[0] : r.report;
  return {
    id: r.id,
    placeId: r.place_id,
    createdAt: r.created_at,
    note: r.note,
    changed: r.changed_decision,
    report: rep
      ? { id: rep.id, placeId: rep.place_id, createdAt: rep.created_at, placeOpen: rep.place_open, areas: rep.areas ?? {}, crowd: rep.crowd, note: rep.note }
      : null,
  };
};

export type LogState = { status: "signed_out" } | { status: "loading" } | { status: "error" } | { status: "ok"; entries: LogEntry[] };

export function useLog(): { state: LogState; retry: () => void } {
  const { db, isLoaded, userId } = useDb();
  const [result, setResult] = useState<{ userId: string; attempt: number; state: LogState } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    db.from("practice_logs")
      .select("id, place_id, created_at, note, changed_decision, report:reports(id, place_id, created_at, place_open, areas, crowd, note)")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return;
        setResult({ userId, attempt, state: error ? { status: "error" } : { status: "ok", entries: (data as Row[]).map(toEntry) } });
      });
    return () => {
      cancelled = true;
    };
  }, [db, userId, attempt]);

  const retry = () => setAttempt((a) => a + 1);
  if (!isLoaded) return { state: { status: "loading" }, retry };
  if (!userId) return { state: { status: "signed_out" }, retry };
  // Derived, so switching accounts or retrying shows loading, not stale rows.
  if (!result || result.userId !== userId || result.attempt !== attempt) return { state: { status: "loading" }, retry };
  return { state: result.state, retry };
}
