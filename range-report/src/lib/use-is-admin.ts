"use client";

import { useEffect, useState } from "react";
import { useDb } from "./db";

// Whether the person signed in is a Range Report admin (the database's admin
// list, via is_admin()). Only decides what to show: every admin action checks
// again in the database.
export function useIsAdmin(): boolean {
  const { db, isLoaded, userId } = useDb();
  const [result, setResult] = useState<{ userId: string; admin: boolean } | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    let cancelled = false;
    db.rpc("is_admin").then(({ data }) => !cancelled && setResult({ userId, admin: data === true }));
    return () => {
      cancelled = true;
    };
  }, [db, isLoaded, userId]);

  return !!userId && result?.userId === userId && result.admin;
}
