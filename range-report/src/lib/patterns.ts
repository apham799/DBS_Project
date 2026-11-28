import type { Condition, Crowd, Place } from "./types";

// What a place is usually like, from the nightly patterns job
// (supabase/migrations/20261129000000_place_patterns.sql), which looks at all
// of its report history. The database decides what counts as a pattern (3+
// reports, 60%+ agreeing); this only words it for the place page.

export type CrowdPattern = { weekday: number; part: "morning" | "afternoon" | "evening"; level: Crowd; count: number; total: number };
export type AreaPattern = { areaId: string; month: number; condition: Condition; count: number; total: number };
export type PlacePatterns = { placeId: string; crowd: CrowdPattern[]; areas: AreaPattern[]; reports: number; since: string | null; computedAt: string };

export type PatternLine = { text: string; basis: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const crowdPhrase: Record<Crowd, string> = { busy: "Usually packed", some_wait: "Usually a short wait", quiet: "Usually quiet" };
const MAX_CROWD_LINES = 3;

const monthIn = (now: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "numeric" }).format(now));

// Crowd patterns first (strongest first, at most three), then how each area
// is usually rated in the current month, in the place's area order.
export function patternLines(p: PlacePatterns, place: Place, now: Date): PatternLine[] {
  const crowd = p.crowd.slice(0, MAX_CROWD_LINES).map((c) => ({
    text: `${crowdPhrase[c.level]} on ${DAYS[c.weekday]} ${c.part}s`,
    basis: `${c.count} of ${c.total} reports`,
  }));
  const month = monthIn(now);
  const areas = place.areas.flatMap((a) => {
    const ap = p.areas.find((x) => x.areaId === a.id && x.month === month);
    return ap ? [{ text: `${a.label} usually ${ap.condition} in ${MONTHS[month - 1]}`, basis: `${ap.count} of ${ap.total} ratings` }] : [];
  });
  return [...crowd, ...areas];
}

// "From all 6 reports since Nov 17 · updated Nov 28, 4:10 AM"
export function patternsFooter(p: PlacePatterns): string {
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });
  const time = new Date(p.computedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
  const from = `From all ${p.reports} report${p.reports === 1 ? "" : "s"}${p.since ? ` since ${day(p.since)}` : ""}`;
  return `${from} · updated nightly, last ${day(p.computedAt)}, ${time}`;
}
