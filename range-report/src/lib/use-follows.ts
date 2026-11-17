"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDb } from "./db";

const NONE: ReadonlySet<string> = new Set();

// The places you follow (signed in only; guests are asked to sign up).
// Follow/unfollow shows at once and is undone if the save fails.
export function useFollows() {
  const { db, isLoaded, userId } = useDb();
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    let cancelled = false;
    db.from("follows")
      .select("place_id")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError("Couldn't load the places you follow.");
        else setFollowing(new Set((data as { place_id: string }[]).map((f) => f.place_id)));
      });
    return () => {
      cancelled = true;
    };
  }, [db, isLoaded, userId]);

  // Places with a save in flight: taps on them are ignored until it lands, so
  // a fast double tap can't send an insert and a delete that race.
  const busy = useRef(new Set<string>());

  const toggle = useCallback(
    async (placeId: string, name: string) => {
      if (!userId || busy.current.has(placeId)) return;
      busy.current.add(placeId);
      setError(null);
      const was = following.has(placeId);
      const apply = (on: boolean) =>
        setFollowing((s) => {
          const next = new Set(s);
          if (on) next.add(placeId);
          else next.delete(placeId);
          return next;
        });
      apply(!was);
      const { error } = was
        ? await db.from("follows").delete().eq("place_id", placeId)
        : await db.from("follows").insert({ place_id: placeId });
      busy.current.delete(placeId);
      // 23505: already following (say, from another tab). That's the state we wanted.
      if (error && error.code !== "23505") {
        apply(was);
        setError(`Couldn't ${was ? "unfollow" : "follow"} ${name}. Check your connection and try again.`);
      }
    },
    [db, userId, following],
  );

  // Signed out, follow nothing (without a state reset that would re-render).
  return { following: userId ? following : NONE, toggle, error, clearError: () => setError(null), signedIn: !!userId };
}
