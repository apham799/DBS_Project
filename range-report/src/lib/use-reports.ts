"use client";

import { useCallback, useEffect, useState } from "react";
import { useDb } from "./db";
import type { Condition, Crowd, Report } from "./types";

// Every report from the last 30 days, kept live. Status only looks back 7 days;
// the rest is for the "recent reports" history on each place page. Fine at v1's
// volume (a few dozen reports); v2's patterns job will summarize older ones.
//
// Order matters (lesson from A5): subscribe first, then load. Each time the
// channel (re)connects we load a fresh snapshot, so nothing posted while the
// laptop slept or the wifi dropped is missed.

const LOOKBACK_DAYS = 30;

type Row = { id: string; place_id: string; created_at: string; place_open: boolean; areas: Record<string, Condition>; crowd: Crowd | null; note: string | null };

const toReport = (r: Row): Report => ({
  id: r.id,
  placeId: r.place_id,
  createdAt: r.created_at,
  placeOpen: r.place_open,
  areas: r.areas ?? {},
  crowd: r.crowd,
  note: r.note ?? null,
});

export type LiveStatus = "connecting" | "live" | "reconnecting";

export function useReports() {
  const { db, isLoaded } = useDb();
  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();
    const { data, error } = await db
      .from("reports")
      .select("id, place_id, created_at, place_open, areas, crowd, note")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    setLoaded(true);
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setReports((data as Row[]).map(toReport));
  }, [db]);

  // Add a report at once (after posting, or from Realtime), without duplicates.
  const add = useCallback((r: Report) => {
    setReports((rs) => (rs.some((x) => x.id === r.id) ? rs : [r, ...rs]));
    setJustAdded((s) => new Set(s).add(r.placeId));
    setTimeout(() => setJustAdded((s) => {
      const next = new Set(s);
      next.delete(r.placeId);
      return next;
    }), 4000);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    const channel = db
      .channel("reports")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        const row = payload.new as Row;
        if (row?.id) add(toReport(row));
      })
      .subscribe((s) => {
        if (cancelled) return;
        if (s === "SUBSCRIBED") {
          setLive("live");
          load();
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setLive("reconnecting");
        }
      });
    return () => {
      cancelled = true;
      db.removeChannel(channel);
    };
  }, [db, isLoaded, load, add]);

  return { reports, loaded, error, live, justAdded, add, retry: load };
}
