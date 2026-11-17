"use client";

import { useEffect, useState } from "react";
import type { AiSummaryResponse } from "@/app/api/summary/[id]/route";

export type AiSummaryState = { status: "idle" } | { status: "loading" } | AiSummaryResponse;

// Asks the server for Claude's summary of one place, and again whenever `key`
// changes (the ids of the reports it's based on), so a new report with a note
// refreshes it without a reload. Off until `enabled` (enough notes to bother).
//
// While a refresh is on its way the previous summary stays up (no flicker back
// to a skeleton); "loading" only shows the first time.
export function useAiSummary(placeId: string, key: string, enabled: boolean): AiSummaryState {
  const [result, setResult] = useState<{ key: string; state: AiSummaryResponse } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch(`/api/summary/${encodeURIComponent(placeId)}`)
      .then((r) => r.json() as Promise<AiSummaryResponse>)
      .catch((): AiSummaryResponse => ({ status: "error" }))
      .then((state) => !cancelled && setResult({ key, state }));
    return () => {
      cancelled = true;
    };
  }, [placeId, key, enabled]);

  if (!enabled) return { status: "idle" };
  return result ? result.state : { status: "loading" };
}
