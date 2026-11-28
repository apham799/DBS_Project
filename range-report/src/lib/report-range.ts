import type { Report } from "./types";

// How far back the "Recent reports" list on a place page goes. The map (right
// now), the summary (30 days) and the patterns (all time) don't change with it.

export type ReportRange = "week" | "month" | "year" | "all";

export const REPORT_RANGES: { id: ReportRange; label: string }[] = [
  { id: "week", label: "Past week" },
  { id: "month", label: "Last 30 days" },
  { id: "year", label: "Past year" },
  { id: "all", label: "All time" },
];

const DAY = 86400_000;
const DAYS: Record<ReportRange, number | null> = { week: 7, month: 30, year: 365, all: null };

// The earliest moment in the range (ms), or null for all time.
export const rangeStart = (range: ReportRange, now: Date): number | null => {
  const days = DAYS[range];
  return days === null ? null : now.getTime() - days * DAY;
};

export function inRange(r: Report, range: ReportRange, now: Date): boolean {
  const start = rangeStart(range, now);
  return start === null || new Date(r.createdAt).getTime() > start;
}

// The app keeps the last 30 days of every place loaded (live); further back
// is loaded for one place when asked for.
export const needsOlder = (range: ReportRange) => range === "year" || range === "all";

const phrase: Record<ReportRange, string> = { week: "in the past week", month: "in the last 30 days", year: "in the past year", all: "all time" };

// "6 in the last 30 days", "14 all time"
export const countLabel = (n: number, range: ReportRange) => `${n} ${phrase[range]}`;

// "No reports in the past week."
export const emptyLabel = (range: ReportRange) => (range === "all" ? "No reports yet." : `No reports ${phrase[range]}.`);
