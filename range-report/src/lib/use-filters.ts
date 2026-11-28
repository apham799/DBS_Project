"use client";

import { useEffect, useState } from "react";
import { FEATURES, NO_FILTERS, type Feature, type Filters } from "./filters";

// Shared by Home and the city map, so a filter set on one is still set on the other.
// Filters last for the browser tab (sessionStorage), so they survive opening a
// place and coming back. Read after mount, so the server render and the first
// browser render agree.
const FILTERS_KEY = "range-report:filters";
const KNOWN = new Set(FEATURES.map((f) => f.id));

export function useFilters(): [Filters, (f: Filters) => void] {
  const [filters, setState] = useState<Filters>(NO_FILTERS);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(FILTERS_KEY) ?? "null") as Partial<Filters> | null;
        if (!saved) return;
        setState({
          features: (saved.features ?? []).filter((f): f is Feature => KNOWN.has(f as Feature)),
          setting: saved.setting === "indoor" || saved.setting === "outdoor" ? saved.setting : null,
          openNow: saved.openNow === true,
        });
      } catch {
        // A bad saved value just means no filters.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const set = (f: Filters) => {
    setState(f);
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify(f));
  };
  return [filters, set];
}
