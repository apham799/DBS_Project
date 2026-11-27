import type { Report } from "./types";

// "Reports from": whose reports count. Everyone, only golfers who were signed
// in, or only guests. Applied once, to the list of reports, before anything is
// computed from it (statuses, the map, summaries, recent reports), so they
// always agree with each other.

export type ReportSource = "everyone" | "accounts" | "guests";

export const REPORT_SOURCES: { id: ReportSource; label: string }[] = [
  { id: "everyone", label: "Everyone" },
  { id: "accounts", label: "Golfers with accounts" },
  { id: "guests", label: "Guests" },
];

export const isReportSource = (v: unknown): v is ReportSource => v === "everyone" || v === "accounts" || v === "guests";

// Reports from before guest posting existed have no source: they're account reports.
export const sourceOf = (r: Report) => r.source ?? "account";

export function bySource(reports: Report[], source: ReportSource): Report[] {
  if (source === "everyone") return reports;
  const want = source === "accounts" ? "account" : "guest";
  return reports.filter((r) => sourceOf(r) === want);
}

// For the note under a narrowed view.
export const sourceNote: Record<ReportSource, string | null> = {
  everyone: null,
  accounts: "Showing reports from golfers with accounts only.",
  guests: "Showing guest reports only.",
};
