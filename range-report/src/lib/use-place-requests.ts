"use client";

import { useCallback, useEffect, useState } from "react";
import { ADDED_PLACE_FIELDS, type AddedPlaceRow } from "./added-places";
import { useDb } from "./db";

// Requests waiting for an admin (only admins can read other golfers'
// requests; for anyone else this is just their own). Live, so a new request
// shows on the Admin page and tab without a reload.
export function usePlaceRequests(enabled = true) {
  const { db } = useDb();
  const [rows, setRows] = useState<AddedPlaceRow[] | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db.from("added_places").select(ADDED_PLACE_FIELDS).eq("status", "pending").order("created_at");
    if (!error) setRows(data as AddedPlaceRow[]);
  }, [db]);

  useEffect(() => {
    if (!enabled) return;
    const channel = db
      .channel(`place-requests-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "added_places" }, () => load())
      .subscribe();
    const t = setTimeout(load, 0);
    return () => {
      clearTimeout(t);
      db.removeChannel(channel);
    };
  }, [db, load, enabled]);

  return { requests: rows ?? [], loaded: rows !== null, reload: load };
}
