"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGuestClient, useDb } from "./db";
import type { Condition, Crowd, Report } from "./types";

// Every report from the last 30 days, kept live. Status only looks back 7 days;
// the rest is for the "recent reports" history on each place page. Fine at v1's
// volume (a few dozen reports); v2's patterns job will summarize older ones.
//
// Order matters (lesson from A5): subscribe first, then load. Each time the
// channel (re)connects we load a fresh snapshot, so nothing posted while the
// laptop slept or the wifi dropped is missed. A snapshot is merged with what's
// already on screen (never replaces it), so a report that arrived live while
// the snapshot was in flight isn't wiped out, and only the newest load counts.

const LOOKBACK_DAYS = 30;

type Row = { id: string; place_id: string; created_at: string; place_open: boolean; areas: Record<string, Condition>; crowd: Crowd | null; note: string | null; source?: "account" | "guest" };

const toReport = (r: Row): Report => ({
  id: r.id,
  placeId: r.place_id,
  createdAt: r.created_at,
  placeOpen: r.place_open,
  areas: r.areas ?? {},
  crowd: r.crowd,
  note: r.note ?? null,
  source: r.source ?? "account",
});

export type LiveStatus = "connecting" | "live" | "reconnecting";

const DAY = 86400_000;

// Union by id, newest first, trimmed to the lookback window.
function merge(snapshot: Report[], current: Report[]): Report[] {
  const byId = new Map<string, Report>();
  for (const r of current) byId.set(r.id, r);
  for (const r of snapshot) byId.set(r.id, r);
  const since = Date.now() - LOOKBACK_DAYS * DAY;
  return [...byId.values()].filter((r) => new Date(r.createdAt).getTime() >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// If Clerk hasn't loaded after this long (a content blocker, an outage), read
// reports as a guest anyway: guests only need the publishable key. When Clerk
// does arrive, everything switches over to the signed-in client.
const AUTH_WAIT_MS = 5000;

export function useReports() {
  const { db: authDb, isLoaded } = useDb();
  const [authTimedOut, setAuthTimedOut] = useState(false);
  const db = isLoaded ? authDb : authTimedOut ? getGuestClient() : null;

  const [reports, setReports] = useState<Report[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const latestLoad = useRef(0);

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setAuthTimedOut(true), AUTH_WAIT_MS);
    return () => clearTimeout(t);
  }, [isLoaded]);

  const load = useCallback(async () => {
    if (!db) return;
    const mine = ++latestLoad.current;
    const since = new Date(Date.now() - LOOKBACK_DAYS * DAY).toISOString();
    const { data, error } = await db
      .from("reports")
      .select("id, place_id, created_at, place_open, areas, crowd, note, source")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (mine !== latestLoad.current) return; // a newer load started; it wins
    setLoaded(true);
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    const snapshot = (data as Row[]).map(toReport);
    setReports((current) => merge(snapshot, current));
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
    if (!db) return;
    let cancelled = false;
    // If the live connection doesn't open (some networks block websockets),
    // load anyway after a few seconds, so the page never sits on skeletons
    // with no way to post. It just won't update on its own.
    const fallback = setTimeout(() => !cancelled && load(), 4000);
    // A unique topic per mount: realtime-js hands back an existing channel with
    // the same name, even one still leaving from the previous page, whose
    // subscribe() then never fires (guests lost live updates after navigating).
    const channel = db
      .channel(`reports-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        const row = payload.new as Row;
        if (row?.id) add(toReport(row));
      })
      .subscribe((s) => {
        if (cancelled) return;
        if (s === "SUBSCRIBED") {
          clearTimeout(fallback);
          setLive("live");
          load();
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          setLive("reconnecting");
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
      db.removeChannel(channel);
    };
  }, [db, load, add]);

  return { reports, loaded, error, live, justAdded, add, retry: load };
}
