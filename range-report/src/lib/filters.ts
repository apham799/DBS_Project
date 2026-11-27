import type { PlaceStatus } from "./status";
import type { Place } from "./types";

// Filtering the place list (from v1 feedback: "I want a driving range, or I
// don't care about one"). Everything is derived from a place's areas, so a new
// place gets the right features without any extra data.

export type Feature = "range" | "heated" | "short_game" | "putting" | "sims";
export type Setting = "indoor" | "outdoor";

export const FEATURES: { id: Feature; label: string }[] = [
  { id: "range", label: "Driving range" },
  { id: "heated", label: "Heated bays" },
  { id: "short_game", label: "Short game" },
  { id: "putting", label: "Putting green" },
  { id: "sims", label: "Simulators" },
];

export type Filters = { features: Feature[]; setting: Setting | null; openNow: boolean };
export const NO_FILTERS: Filters = { features: [], setting: null, openNow: false };

// Indoor: nothing outdoors (simulator places, the dome). Outdoor: a range you
// hit outside, even from heated, covered stalls.
export const settingOf = (p: Place): Setting => (p.areas.some((a) => a.outdoor) ? "outdoor" : "indoor");

export function featuresOf(p: Place): Set<Feature> {
  const f = new Set<Feature>();
  for (const a of p.areas) {
    if (p.kind === "sim") {
      if (a.kind === "bays") f.add("sims");
    } else if (a.kind === "range" || a.kind === "bays") {
      // A walk-in place's bays are hitting stalls onto a range (or a dome).
      f.add("range");
      if (a.kind === "bays") f.add("heated");
    }
    if (a.kind === "chipping" || a.kind === "bunker") f.add("short_game");
    if (a.kind === "putting") f.add("putting");
  }
  return f;
}

// A place matches if it has every feature asked for (AND), is in the chosen
// setting, and, if asked, is open by its hours right now.
export function matches(p: Place, status: PlaceStatus | undefined, filters: Filters): boolean {
  const have = featuresOf(p);
  if (!filters.features.every((f) => have.has(f))) return false;
  if (filters.setting && settingOf(p) !== filters.setting) return false;
  if (filters.openNow && !status?.hours.open) return false;
  return true;
}

export const isFiltering = (f: Filters) => f.features.length > 0 || f.setting !== null || f.openNow;
