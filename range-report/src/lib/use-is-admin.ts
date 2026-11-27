"use client";

import { useEffect, useState } from "react";
import { useDb } from "./db";

export type AdminCheck = "loading" | "signed-out" | "admin" | "not-admin";

// Whether the person signed in is a Range Report admin (the database's admin
// list, via is_admin()). Only decides what to show: every admin action checks
// again in the database.
export function useAdminCheck(): AdminCheck {
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

  if (!isLoaded) return "loading";
  if (!userId) return "signed-out";
  if (result?.userId !== userId) return "loading";
  return result.admin ? "admin" : "not-admin";
}

export function useIsAdmin(): boolean {
  return useAdminCheck() === "admin";
}
