import { chicagoParts, weekdayLabel } from "./chicago-time";
import { CLOCK_SKEW } from "./status";
import type { Condition, Crowd, Place, Report } from "./types";

// What past reports at a place add up to, computed from the data alone (no AI),
// so every line can be checked against the reports listed under it.
//
// Status (status.ts) answers "what's it like right now?". This answers "what's
// it usually like?": how each area has been rated lately, how often people
// found it closed, and when it tends to be packed or empty.

export const crowdWord: Record<Crowd, string> = { quiet: "Walk right in", some_wait: "Short wait", busy: "Packed" };
const conditionWord: Record<Condition, string> = { good: "good", limited: "limited", closed: "closed" };

// One report in a line: "Range: good · Chipping area: closed · Packed".
export function reportLine(place: Place, r: Report): string {
  if (!r.placeOpen) return "Closed when they got there";
  const parts = place.areas.filter((a) => r.areas[a.id]).map((a) => `${a.label}: ${conditionWord[r.areas[a.id]]}`);
  if (r.crowd) parts.push(crowdWord[r.crowd]);
  return parts.length ? parts.join(" · ") : "Open";
}

export const SUMMARY_DAYS = 30;
// Below this, a "pattern" is just one person's visit, so no summary is shown.
export const MIN_REPORTS = 2;
// The AI only writes a summary once a place has this many public notes.
export const MIN_NOTES = 3;
// A crowd pattern needs at least this many matching reports in the same slot.
const MIN_CROWD = 2;

export type AreaTrend = {
  areaId: string;
  label: string;
  rated: number; // reports that rated this area
  counts: Record<Condition, number>;
  top: Condition; // most common rating (ties go to the most recent)
  latest: Condition;
  latestAt: string; // when the latest rating was posted
};

export type Summary = {
  total: number;
  thisWeek: number;
  closedVisits: number;
  areas: AreaTrend[]; // in the place's area order, only areas someone rated
  busiest: { slot: string; count: number } | null; // "Sat mornings"
  quietest: { slot: string; count: number } | null;
  notes: number;
};

// "Sat mornings", "Tue evenings", in Chicago time.
function slotOf(iso: string): string {
  const { weekday, minutes } = chicagoParts(new Date(iso));
  const part = minutes < 12 * 60 ? "mornings" : minutes < 17 * 60 ? "afternoons" : "evenings";
  return `${weekdayLabel(weekday)} ${part}`;
}

// The slot with the most reports of one crowd level; ties go to the slot seen
// most recently. Null unless some slot reaches MIN_CROWD.
function topSlot(reports: Report[], level: Crowd): { slot: string; count: number } | null {
  const counts = new Map<string, number>(); // insertion order = newest first
  for (const r of reports) {
    if (r.crowd !== level) continue;
    const slot = slotOf(r.createdAt);
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }
  let best: { slot: string; count: number } | null = null;
  for (const [slot, count] of counts) if (count >= MIN_CROWD && (!best || count > best.count)) best = { slot, count };
  return best;
}

// This place's reports from the last `days` days (none from the future beyond
// CLOCK_SKEW), newest
// first. The summary and the "1 of 2 reports needed" count both use this, so
// they always agree on what counts.
export function recentReports(place: Place, allReports: Report[], now: Date, days = SUMMARY_DAYS): Report[] {
  const t = now.getTime();
  return allReports
    .filter((r) => r.placeId === place.id)
    .filter((r) => {
      const at = new Date(r.createdAt).getTime();
      return at <= t + CLOCK_SKEW && at > t - days * 86400_000;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// How each area has been rated in `recent` (newest first, e.g. from
// recentReports): counts for every option, the most common, and the latest.
// Only explicit area ratings count; a "closed when I got there" visit is about
// the whole place. Areas nobody rated are left out; place order is kept.
export function areaTrends(place: Place, recent: Report[]): AreaTrend[] {
  const out: AreaTrend[] = [];
  for (const a of place.areas) {
    const rated = recent.filter((r) => r.placeOpen && r.areas[a.id]);
    if (!rated.length) continue;
    const ratings = rated.map((r) => r.areas[a.id]);
    const counts: Record<Condition, number> = { good: 0, limited: 0, closed: 0 };
    for (const c of ratings) counts[c]++;
    const max = Math.max(counts.good, counts.limited, counts.closed);
    // Newest first, so the first rating with the top count is the most recent one.
    const top = ratings.find((c) => counts[c] === max)!;
    out.push({ areaId: a.id, label: a.label, rated: ratings.length, counts, top, latest: ratings[0], latestAt: rated[0].createdAt });
  }
  return out;
}

export function summarizeReports(place: Place, allReports: Report[], now: Date, days = SUMMARY_DAYS): Summary | null {
  const t = now.getTime();
  const reports = recentReports(place, allReports, now, days);
  if (reports.length < MIN_REPORTS) return null;

  const areas = areaTrends(place, reports);

  return {
    total: reports.length,
    thisWeek: reports.filter((r) => new Date(r.createdAt).getTime() > t - 7 * 86400_000).length,
    closedVisits: reports.filter((r) => !r.placeOpen).length,
    areas,
    busiest: topSlot(reports, "busy"),
    quietest: topSlot(reports, "quiet"),
    notes: reports.filter((r) => r.note).length,
  };
}

const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

// The summary as plain sentences, in the order a golfer cares about them.
export function summaryLines(s: Summary, days = SUMMARY_DAYS): string[] {
  const lines = [`${s.total} reports in the last ${days} days${s.thisWeek ? `, ${s.thisWeek} this week` : ""}.`];
  if (s.closedVisits) lines.push(`Found closed ${times(s.closedVisits)}.`);
  for (const a of s.areas) {
    const n = a.counts[a.top];
    const share = a.rated === 1 ? "in the only report that rated it" : n === a.rated ? (a.rated === 2 ? "in both reports" : `in all ${a.rated} reports`) : `in ${n} of ${a.rated} reports`;
    const but = a.latest !== a.top ? `, but the latest said ${conditionWord[a.latest]}` : "";
    lines.push(`${a.label}: ${conditionWord[a.top]} ${share}${but}.`);
  }
  if (s.busiest) lines.push(`Packed most often on ${s.busiest.slot} (${s.busiest.count} reports).`);
  if (s.quietest) lines.push(`Easiest to walk right in on ${s.quietest.slot} (${s.quietest.count} reports).`);
  return lines;
}
