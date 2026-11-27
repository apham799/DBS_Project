"use client";

import { useCallback, useEffect, useState } from "react";
import { useDb } from "./db";

// Your votes on reports, and which reports are yours (you can't vote on those:
// the database refuses, and the buttons say so). Signed out: no votes; voting
// asks you to sign in.

export type Vote = 1 | -1;

export function useVotes(onChanged: (reportId: string) => void) {
  const { db, isLoaded, userId } = useDb();
  const [mine, setMine] = useState<{ userId: string; votes: Map<string, Vote>; own: Set<string> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    let cancelled = false;
    Promise.all([db.from("report_votes").select("report_id, value"), db.from("practice_logs").select("report_id")]).then(([v, l]) => {
      if (cancelled) return;
      const votes = new Map<string, Vote>(((v.data ?? []) as { report_id: string; value: Vote }[]).map((x) => [x.report_id, x.value]));
      const own = new Set(((l.data ?? []) as { report_id: string | null }[]).flatMap((x) => (x.report_id ? [x.report_id] : [])));
      setMine({ userId, votes, own });
    });
    return () => {
      cancelled = true;
    };
  }, [db, isLoaded, userId]);

  const current = mine && mine.userId === userId ? mine : null;

  // Tap the same arrow again to take your vote back.
  const vote = useCallback(
    async (reportId: string, value: Vote) => {
      if (!current) return;
      const next = current.votes.get(reportId) === value ? 0 : value;
      setError(null);
      const { error } = await db.rpc("vote_report", { p_report_id: reportId, p_value: next });
      if (error) {
        setError(error.code === "RR403" ? "You can't vote on your own report." : "Your vote didn't save. Try again.");
        return;
      }
      setMine((m) => {
        if (!m) return m;
        const votes = new Map(m.votes);
        if (next === 0) votes.delete(reportId);
        else votes.set(reportId, next);
        return { ...m, votes };
      });
      onChanged(reportId);
    },
    [current, db, onChanged],
  );

  return {
    signedIn: !!userId,
    myVote: (id: string) => current?.votes.get(id) ?? 0,
    isMine: (id: string) => current?.own.has(id) ?? false,
    vote,
    error,
    clearError: () => setError(null),
  };
}
