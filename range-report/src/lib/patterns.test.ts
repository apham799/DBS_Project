import { describe, expect, it } from "vitest";
import { patternLines, patternsFooter, type PlacePatterns } from "./patterns";
import type { Place } from "./types";

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
    { id: "range", kind: "range", label: "Driving range", outdoor: true },
    { id: "chipping", kind: "chipping", label: "Short game area", outdoor: true },
  ],
  hours: "24/7",
  hoursNote: "",
  seasons: [],
};

// Nov 28, 2026, noon in Chicago.
const NOV = new Date("2026-11-28T18:00:00Z");

const patterns = (p: Partial<PlacePatterns> = {}): PlacePatterns => ({
  placeId: "test-range",
  crowd: [],
  areas: [],
  reports: 12,
  since: "2026-11-17T05:44:00Z",
  computedAt: "2026-11-28T10:10:00Z",
  ...p,
});

describe("patternLines", () => {
  it("words crowd patterns by day and part of the day, with how many reports back them", () => {
    const lines = patternLines(patterns({ crowd: [{ weekday: 6, part: "morning", level: "busy", count: 4, total: 5 }] }), place, NOV);
    expect(lines).toEqual([{ text: "Usually packed on Saturday mornings", basis: "4 of 5 reports" }]);
  });

  it("shows at most three crowd lines, strongest first as the job orders them", () => {
    const crowd = [0, 1, 2, 3].map((d) => ({ weekday: d, part: "evening" as const, level: "quiet" as const, count: 3, total: 3 }));
    const lines = patternLines(patterns({ crowd }), place, NOV);
    expect(lines.map((l) => l.text)).toEqual(["Usually quiet on Sunday evenings", "Usually quiet on Monday evenings", "Usually quiet on Tuesday evenings"]);
  });

  it("shows area patterns for this month only, in the place's area order", () => {
    const areas = [
      { areaId: "chipping", month: 11, condition: "limited" as const, count: 6, total: 7 },
      { areaId: "range", month: 11, condition: "good" as const, count: 3, total: 4 },
      { areaId: "range", month: 7, condition: "good" as const, count: 9, total: 9 }, // July: not now
    ];
    expect(patternLines(patterns({ areas }), place, NOV)).toEqual([
      { text: "Driving range usually good in November", basis: "3 of 4 ratings" },
      { text: "Short game area usually limited in November", basis: "6 of 7 ratings" },
    ]);
  });

  it("skips areas the place no longer has", () => {
    const areas = [{ areaId: "bunker", month: 11, condition: "closed" as const, count: 3, total: 3 }];
    expect(patternLines(patterns({ areas }), place, NOV)).toEqual([]);
  });
});

describe("patternsFooter", () => {
  it("says how many reports, since when, and when it last ran (Chicago time)", () => {
    expect(patternsFooter(patterns())).toBe("From all 12 reports since Nov 16 · updated nightly, last Nov 28, 4:10 AM");
  });
});
