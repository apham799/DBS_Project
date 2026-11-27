"use client";

import { useCallback, useSyncExternalStore } from "react";

// Suggestions an admin has dismissed, for this browser tab's session. Shared by
// the place pages, the Admin page and the count on the Admin tab, so
// dismissing in one spot hides it everywhere. Keys are per place: the same
// suggestion key (say "agree:range:good") can come up at two places.

const KEY = "range-report:dismissed-suggestions";
const EVENT = "range-report:dismissed-changed";
const NONE: string[] = [];

let cachedRaw: string | null = null;
let cached: string[] = NONE;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return NONE;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    cached = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : NONE;
  } catch {
    cached = NONE;
  }
  return cached;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export const dismissKey = (placeId: string, key: string) => `${placeId}/${key}`;

export function useDismissed() {
  const dismissed = useSyncExternalStore(subscribe, read, () => NONE);
  const isDismissed = useCallback((placeId: string, key: string) => dismissed.includes(dismissKey(placeId, key)), [dismissed]);
  const dismiss = useCallback((placeId: string, key: string) => {
    const next = [...read(), dismissKey(placeId, key)];
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { isDismissed, dismiss };
}
