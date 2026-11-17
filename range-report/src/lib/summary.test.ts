import { describe, expect, it } from "vitest";
import { recentReports, reportLine, summarizeReports, summaryLines } from "./summary";
import type { Place, Report } from "./types";

const place: Place = {
  id: "test-range",
  name: "Test Range",
  kind: "walk_in",
  neighborhood: "",
  address: "",
  lat: 0,
  lon: 0,
  website: "",
  areas: [
    { id: "range", kind: "range", label: "Range", outdoor: true },
    { id: "chipping", kind: "chipping", label: "Chipping area", outdoor: true },
    { id: "putting", kind: "putting", label: "Putting green", outdoor: true },
  ],
  hours: "24/7",
  hoursNote: "",
  seasons: [],
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;
// Saturday Nov 14, 2026, 2:00 PM in Chicago (UTC-6).
const NOW = new Date("2026-11-14T20:00:00Z");

let n = 0;
const report = (ago: number, r: Partial<Report> = {}): Report => ({
  id: `r${n++}`,
  placeId: place.id,
  createdAt: new Date(NOW.getTime() - ago).toISOString(),
  placeOpen: true,
  areas: {},
  crowd: null,
  note: null,
  ...r,
});

describe("summarizeReports", () => {
  it("needs at least two reports at this place in the window", () => {
    expect(summarizeReports(place, [], NOW)).toBeNull();
    expect(summarizeReports(place, [report(HOUR)], NOW)).toBeNull();
    // Other places, future reports and reports older than 30 days don't count.
    const noise = [report(HOUR, { placeId: "elsewhere" }), report(-HOUR), report(31 * DAY)];
    expect(summarizeReports(place, [report(HOUR), ...noise], NOW)).toBeNull();
  });

  it("counts reports, this week, closed visits and notes", () => {
    const s = summarizeReports(place, [report(HOUR, { note: "Mats only" }), report(3 * DAY, { placeOpen: false }), report(10 * DAY)], NOW)!;
    expect(s).toMatchObject({ total: 3, thisWeek: 2, closedVisits: 1, notes: 1 });
  });

  it("finds each area's most common rating and flags when the latest differs", () => {
    const s = summarizeReports(
      place,
      [
        report(1 * HOUR, { areas: { chipping: "good", range: "good" } }),
        report(2 * DAY, { areas: { chipping: "closed" } }),
        report(4 * DAY, { areas: { chipping: "closed" } }),
        report(6 * DAY, { areas: { chipping: "closed" } }),
      ],
      NOW,
    )!;
    const chipping = s.areas.find((a) => a.areaId === "chipping")!;
    expect(chipping).toMatchObject({ rated: 4, top: "closed", latest: "good", counts: { good: 1, limited: 0, closed: 3 } });
    // Areas nobody rated are left out; place order is kept.
    expect(s.areas.map((a) => a.areaId)).toEqual(["range", "chipping"]);
    expect(summaryLines(s)).toContain("Chipping area: closed in 3 of 4 reports, but the latest said good.");
    expect(summaryLines(s)).toContain("Range: good in the only report that rated it.");
  });

  it("breaks a tie toward the more recent rating", () => {
    const s = summarizeReports(place, [report(HOUR, { areas: { range: "limited" } }), report(DAY, { areas: { range: "good" } })], NOW)!;
    expect(s.areas[0]).toMatchObject({ top: "limited", latest: "limited" });
  });

  it("ignores area ratings on a closed visit", () => {
    const s = summarizeReports(place, [report(HOUR, { placeOpen: false, areas: { range: "good" } }), report(DAY)], NOW)!;
    expect(s.areas).toEqual([]);
  });

  it("finds when it's packed and when it's quiet, in Chicago time", () => {
    // Saturdays at 9 AM Chicago = 15:00 UTC; Tuesday Nov 10 at 6 PM = Nov 11 00:00 UTC.
    const at = (iso: string, crowd: Report["crowd"]) => ({ ...report(0, { crowd }), createdAt: iso });
    const s = summarizeReports(
      place,
      [
        at("2026-11-14T15:00:00Z", "busy"),
        at("2026-11-07T15:30:00Z", "busy"),
        at("2026-11-07T21:00:00Z", "busy"), // Sat afternoon: a different slot
        at("2026-11-11T00:00:00Z", "quiet"),
        at("2026-11-04T00:30:00Z", "quiet"),
      ],
      NOW,
    )!;
    expect(s.busiest).toEqual({ slot: "Sat mornings", count: 2 });
    expect(s.quietest).toEqual({ slot: "Tue evenings", count: 2 });
  });

  it("doesn't call one report a pattern", () => {
    const s = summarizeReports(place, [report(HOUR, { crowd: "busy" }), report(DAY, { crowd: "quiet" })], NOW)!;
    expect(s.busiest).toBeNull();
    expect(s.quietest).toBeNull();
  });
});

describe("recentReports", () => {
  it("keeps this place's reports from the window, newest first", () => {
    const older = report(5 * DAY);
    const newer = report(HOUR);
    const kept = recentReports(place, [older, report(HOUR, { placeId: "elsewhere" }), report(-HOUR), report(31 * DAY), newer], NOW);
    expect(kept.map((r) => r.id)).toEqual([newer.id, older.id]);
  });
});

describe("summaryLines", () => {
  it("reads like sentences", () => {
    const s = summarizeReports(place, [report(HOUR, { areas: { putting: "good" } }), report(2 * HOUR, { areas: { putting: "good" } }), report(8 * DAY, { placeOpen: false })], NOW)!;
    expect(summaryLines(s)).toEqual(["3 reports in the last 30 days, 2 this week.", "Found closed once.", "Putting green: good in both reports."]);
  });
});

describe("reportLine", () => {
  it("lists rated areas in place order, then the crowd", () => {
    expect(reportLine(place, report(0, { areas: { putting: "good", range: "limited" }, crowd: "busy" }))).toBe("Range: limited · Putting green: good · Packed");
    expect(reportLine(place, report(0, { placeOpen: false }))).toBe("Closed when they got there");
    expect(reportLine(place, report(0))).toBe("Open");
  });
});
