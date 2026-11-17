"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { PlaceWeather } from "./weather-server";

export type WeatherState = { status: "loading" } | { status: "ok"; byPlace: Record<string, PlaceWeather> } | { status: "error" };

// Weather is a nice-to-have on every screen: if it fails, statuses still show
// (without the storm check) and only the weather line says so.
export function useWeather(refreshMs = 10 * 60_000): WeatherState {
  const [state, setState] = useState<WeatherState>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/weather")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((byPlace) => !cancelled && setState({ status: "ok", byPlace }))
        .catch(() => !cancelled && setState((s) => (s.status === "ok" ? s : { status: "error" })));
    load();
    const t = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [refreshMs]);
  return state;
}

// A clock that ticks every 30 seconds, so "5 min ago" counts up and statuses
// expire on their own (a crowd report disappears after 2 hours without a reload).
// It only exists in the browser: during prerendering it's null, so a status is
// never baked into the page at build time. One shared timer for every component.
let current: Date | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!timer) {
    current = new Date();
    timer = setInterval(() => {
      current = new Date();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): Date | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
