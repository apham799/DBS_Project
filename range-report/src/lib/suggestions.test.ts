import { describe, expect, it } from "vitest";
import { closingTimesIn, suggestionsFor } from "./suggestions";
import type { Place, Report } from "./types";

const place: Place = {
  id: "h",
  name: "H",
  kind: "walk_in",
  neighborhood: "",
  address: "",
  lat: 0,
  lon: 0,
  website: "",
  areas: [
    { id: "range", kind: "range", label: "Range", outdoor: true },
    { id: "putting", kind: "putting", label: "Putting green", outdoor: true },
  ],
  hours: [{ days: [0, 1, 2, 3, 4, 5, 6], open: "06:00", close: "16:30" }],
  hoursNote: "",
  seasons: [],
};
const NOW = new Date("2026-11-28T18:00:00Z");
let n = 0;
const rep = (daysAgo: number, f: Partial<Report> = {}): Report => ({
  id: `r${n++}`,
  placeId: "h",
  createdAt: new Date(NOW.getTime() - daysAgo * 86400_000).toISOString(),
  placeOpen: true,
  areas: {},
  crowd: null,
  ...f,
});

describe("closing times in notes", () => {
  it("reads the ways golfers write it", () => {
    expect(closingTimesIn("they do close by 3:30.")).toEqual([15 * 60 + 30]);
    expect(closingTimesIn("Closes at 4 pm today")).toEqual([16 * 60]);
    expect(closingTimesIn("closing around 5:15, and the range closed at 11 am")).toEqual([17 * 60 + 15, 11 * 60]);
    expect(closingTimesIn("Mats only, plenty of space")).toEqual([]);
  });
});

describe("suggestions", () => {
  it("proposes confirming what golfers agree on", () => {
    const reports = [1, 2, 3, 4].map((d) => rep(d, { areas: { range: "limited" } }));
    const s = suggestionsFor(place, reports, NOW);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ kind: "agree", title: "Confirm Range: limited?", rule: { areaId: "range", condition: "limited" } });
    expect(s[0].reportIds).toHaveLength(4);
  });

  it("stays quiet when golfers disagree, there are too few, or it's already confirmed", () => {
    const split = [rep(1, { areas: { range: "limited" } }), rep(2, { areas: { range: "good" } }), rep(3, { areas: { range: "closed" } })];
    expect(suggestionsFor(place, split, NOW)).toEqual([]);
    expect(suggestionsFor(place, [rep(1, { areas: { range: "limited" } }), rep(2, { areas: { range: "limited" } })], NOW)).toEqual([]);
    const confirmed: Place = { ...place, confirmed: [{ id: "c", areaId: "range", condition: "limited", note: "Mats only", startsOn: "2026-11-01", endsOn: null }] };
    expect(suggestionsFor(confirmed, [1, 2, 3].map((d) => rep(d, { areas: { range: "limited" } })), NOW)).toEqual([]);
  });

  it("flags a published season golfers contradict", () => {
    const seasonal: Place = { ...place, seasons: [{ from: "2026-11-16", condition: "closed", note: "Closed for the season" }] };
    const s = suggestionsFor(seasonal, [1, 2, 3].map((d) => rep(d, { areas: { range: "limited" } })), NOW);
    expect(s[0]).toMatchObject({ kind: "season", title: 'Range: golfers say limited, not "Closed for the season"' });
  });

  it("asks to review a confirmed status recent reports disagree with", () => {
    const confirmed: Place = { ...place, confirmed: [{ id: "c9", areaId: "range", condition: "closed", note: "Range closed for winter", startsOn: "2026-11-20", endsOn: null }] };
    const s = suggestionsFor(confirmed, [rep(1, { areas: { range: "good" } }), rep(2, { areas: { range: "limited" } })], NOW);
    expect(s.find((x) => x.kind === "review")).toMatchObject({ ruleId: "c9", title: 'Review "Range closed for winter"' });
  });

  it("notices notes that mention a different closing time", () => {
    const s = suggestionsFor(place, [rep(2, { note: "Mats only and they close by 3:30." })], NOW);
    expect(s).toEqual([expect.objectContaining({ kind: "hours", closesAt: "15:30", title: "Check the hours: golfers mention closing at 3:30 PM" })]);
    // Matching the hours: nothing to say.
    expect(suggestionsFor({ ...place, hours: [{ days: [0, 1, 2, 3, 4, 5, 6], open: "06:00", close: "15:30" }] }, [rep(2, { note: "close by 3:30" })], NOW)).toEqual([]);
  });
});
