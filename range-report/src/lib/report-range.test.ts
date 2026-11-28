import { describe, expect, it } from "vitest";
import { countLabel, emptyLabel, inRange, needsOlder, rangeStart } from "./report-range";
import type { Report } from "./types";

const NOW = new Date("2026-11-28T18:00:00Z");
const DAY = 86400_000;
const at = (daysAgo: number): Report => ({
  id: String(daysAgo),
  placeId: "x",
  createdAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
  placeOpen: true,
  areas: {},
  crowd: null,
});

describe("report ranges", () => {
  it("keep reports newer than the range's start", () => {
    expect(inRange(at(6.9), "week", NOW)).toBe(true);
    expect(inRange(at(7.1), "week", NOW)).toBe(false);
    expect(inRange(at(29), "month", NOW)).toBe(true);
    expect(inRange(at(31), "month", NOW)).toBe(false);
    expect(inRange(at(364), "year", NOW)).toBe(true);
    expect(inRange(at(366), "year", NOW)).toBe(false);
    expect(inRange(at(5000), "all", NOW)).toBe(true);
    expect(rangeStart("all", NOW)).toBeNull();
  });

  it("only load more for the ranges past the 30 days the app keeps", () => {
    expect(["week", "month", "year", "all"].map((r) => needsOlder(r as never))).toEqual([false, false, true, true]);
  });

  it("word the count and the empty state", () => {
    expect(countLabel(6, "month")).toBe("6 in the last 30 days");
    expect(countLabel(14, "all")).toBe("14 all time");
    expect(emptyLabel("week")).toBe("No reports in the past week.");
    expect(emptyLabel("all")).toBe("No reports yet.");
  });
});
