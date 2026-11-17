import { describe, expect, it } from "vitest";
import { hoursNow } from "./hours";
import { placeStatus, WINDOWS } from "./status";
import type { Place, Report } from "./types";

// A Harborside-like place. Chicago is UTC-6 in November (after DST ends).
const range: Place = {
  id: "test-range",
  name: "Test Range",
  kind: "walk_in",
  neighborhood: "South Side",
  address: "",
  lat: 41.69,
  lon: -87.59,
  website: "",
  areas: [
    { id: "range", kind: "range", label: "Range", outdoor: true },
    { id: "putting", kind: "putting", label: "Putting green", outdoor: true },
    { id: "chipping", kind: "chipping", label: "Chipping area", outdoor: true },
    { id: "bays", kind: "bays", label: "Heated bays", outdoor: false },
  ],
  hours: [{ days: [0, 1, 2, 3, 4, 5, 6], open: "06:00", close: "18:00" }],
  hoursNote: "",
  seasons: [],
};

const HOUR = 3600_000;
const DAY = 24 * HOUR;
// Saturday Nov 14, 2026, 2:00 PM in Chicago.
const SAT_2PM = new Date("2026-11-14T20:00:00Z");

let n = 0;
function report(at: Date, fields: Partial<Report> = {}): Report {
  return {
    id: `r${++n}`,
    placeId: range.id,
    createdAt: at.toISOString(),
    placeOpen: true,
    areas: {},
    crowd: null,
    ...fields,
  };
}
const ago = (ms: number, from = SAT_2PM) => new Date(from.getTime() - ms);
const area = (status: ReturnType<typeof placeStatus>, id: string) => status.areas.find((a) => a.area.id === id)!;

describe("the quiz case: Saturday 2 PM, last report 4 days ago", () => {
  const wed = report(ago(4 * DAY), { areas: { chipping: "closed", range: "good" }, crowd: "quiet" });
  const s = placeStatus(range, [wed], SAT_2PM);

  it("says chipping is probably still closed, with its age", () => {
    expect(area(s, "chipping")).toMatchObject({ state: "closed", basis: "likely" });
    expect(area(s, "chipping").reason).toBe("Probably still closed: reported 4 days ago");
  });

  it("falls back to hours for the range: 'good' doesn't last 4 days", () => {
    expect(area(s, "range")).toMatchObject({ state: "open", basis: "hours" });
    expect(area(s, "range").reason).toContain("last report 4 days ago");
  });

  it("does not show Wednesday's crowd on Saturday", () => {
    expect(s.crowd).toBeNull();
  });
});

describe("how long reports last", () => {
  it("a problem is 'reported' for a day, then 'probably' until a week, then gone", () => {
    const at = (age: number) => area(placeStatus(range, [report(ago(age), { areas: { chipping: "limited" } })], SAT_2PM), "chipping");
    expect(at(WINDOWS.problemFresh - 1)).toMatchObject({ state: "limited", basis: "report" });
    expect(at(WINDOWS.problemFresh)).toMatchObject({ state: "limited", basis: "likely" });
    expect(at(WINDOWS.problem - 1)).toMatchObject({ state: "limited", basis: "likely" });
    expect(at(WINDOWS.problem)).toMatchObject({ state: "open", basis: "hours" });
  });

  it("'good' is trusted for a day", () => {
    const at = (age: number) => area(placeStatus(range, [report(ago(age), { areas: { putting: "good" } })], SAT_2PM), "putting");
    expect(at(WINDOWS.good - 1)).toMatchObject({ state: "open", basis: "report" });
    expect(at(WINDOWS.good)).toMatchObject({ state: "open", basis: "hours" });
  });

  it("an expired newer report doesn't bring back an older problem", () => {
    // Monday: chipping closed. Thursday: chipping good. By Saturday, Thursday's
    // "good" has expired, but it still replaced Monday's "closed".
    const s = placeStatus(
      range,
      [report(ago(5 * DAY), { areas: { chipping: "closed" } }), report(ago(2 * DAY), { areas: { chipping: "good" } })],
      SAT_2PM,
    );
    expect(area(s, "chipping")).toMatchObject({ state: "open", basis: "hours" });
  });

  it("crowd reports last 2 hours", () => {
    expect(placeStatus(range, [report(ago(WINDOWS.crowd - 1), { crowd: "busy" })], SAT_2PM).crowd).toMatchObject({ level: "busy", age: "1 h ago" });
    expect(placeStatus(range, [report(ago(WINDOWS.crowd), { crowd: "busy" })], SAT_2PM).crowd).toBeNull();
  });

  it("an area nobody mentioned keeps its own status", () => {
    const s = placeStatus(range, [report(ago(HOUR), { areas: { chipping: "closed" } })], SAT_2PM);
    expect(area(s, "putting")).toMatchObject({ state: "open", basis: "hours", reason: "Open by its hours · no reports yet" });
  });
});

describe("'it was closed when I got there'", () => {
  const closedAt10 = report(ago(4 * HOUR), { placeOpen: false });

  it("closes every area for the rest of that day", () => {
    const s = placeStatus(range, [closedAt10], SAT_2PM);
    expect(s.areas.every((a) => a.state === "closed" && a.basis === "report")).toBe(true);
    expect(area(s, "range").reason).toBe("Reported closed today, 4 h ago");
  });

  it("doesn't carry over to the next day", () => {
    const sunday10am = new Date("2026-11-15T16:00:00Z");
    expect(area(placeStatus(range, [closedAt10], sunday10am), "range")).toMatchObject({ state: "open", basis: "hours" });
  });

  it("is replaced by a newer report the same day", () => {
    const s = placeStatus(range, [closedAt10, report(ago(HOUR), { areas: { range: "good" } })], SAT_2PM);
    expect(area(s, "range")).toMatchObject({ state: "open", basis: "report" });
  });
});

describe("seasonal rules", () => {
  const seasonal: Place = {
    ...range,
    seasons: [{ from: "2026-11-16", to: "2027-04-14", areas: ["chipping"], condition: "closed", note: "Closed for the season" }],
  };
  const tuesday = new Date("2026-11-17T20:00:00Z");

  it("apply from their start date", () => {
    expect(area(placeStatus(seasonal, [], SAT_2PM), "chipping")).toMatchObject({ state: "open", basis: "hours" });
    expect(area(placeStatus(seasonal, [], tuesday), "chipping")).toMatchObject({ state: "closed", basis: "season", reason: "Closed for the season" });
  });

  it("only cover the areas they name", () => {
    expect(area(placeStatus(seasonal, [], tuesday), "range")).toMatchObject({ state: "open", basis: "hours" });
  });

  it("aren't overridden by a report from before the season started", () => {
    const sunday = report(new Date("2026-11-15T18:00:00Z"), { areas: { chipping: "good" } });
    expect(area(placeStatus(seasonal, [sunday], new Date("2026-11-16T15:00:00Z")), "chipping")).toMatchObject({ basis: "season" });
  });

  it("are overridden by a golfer who was there after it started", () => {
    const s = placeStatus(seasonal, [report(ago(HOUR, tuesday), { areas: { chipping: "limited" } })], tuesday);
    expect(area(s, "chipping")).toMatchObject({ state: "limited", basis: "report" });
  });
});

describe("hours and weather come first", () => {
  it("everything is closed outside published hours, whatever the reports say", () => {
    const sat7pm = new Date("2026-11-15T01:00:00Z");
    const s = placeStatus(range, [report(ago(HOUR, sat7pm), { areas: { range: "good" }, crowd: "quiet" })], sat7pm);
    expect(s.areas.every((a) => a.state === "closed" && a.basis === "hours")).toBe(true);
    expect(s.hours.label).toBe("Closed · opens Sun 6 AM");
    expect(s.crowd).toBeNull();
  });

  it("a thunderstorm closes outdoor areas but not indoor bays", () => {
    const s = placeStatus(range, [report(ago(HOUR), { areas: { range: "good", bays: "good" } })], SAT_2PM, { stormNow: true });
    expect(area(s, "range")).toMatchObject({ state: "closed", basis: "weather" });
    expect(area(s, "bays")).toMatchObject({ state: "open", basis: "report" });
  });
});

describe("conflicting and odd reports", () => {
  it("newest wins, but a disagreement within 3 hours is flagged", () => {
    const s = placeStatus(
      range,
      [report(ago(3 * HOUR), { areas: { chipping: "closed" } }), report(ago(HOUR), { areas: { chipping: "good" } })],
      SAT_2PM,
    );
    expect(area(s, "chipping")).toMatchObject({ state: "open", basis: "report", conflict: true });
  });

  it("reports further apart aren't a conflict", () => {
    const s = placeStatus(
      range,
      [report(ago(5 * HOUR), { areas: { chipping: "closed" } }), report(ago(HOUR), { areas: { chipping: "good" } })],
      SAT_2PM,
    );
    expect(area(s, "chipping").conflict).toBe(false);
  });

  it("ignores reports for other places and from the future, in any order", () => {
    const s = placeStatus(
      range,
      [
        report(ago(-HOUR), { areas: { chipping: "closed" } }),
        report(ago(HOUR), { placeId: "elsewhere", areas: { chipping: "closed" } }),
        report(ago(2 * HOUR), { areas: { chipping: "good" } }),
      ],
      SAT_2PM,
    );
    expect(area(s, "chipping")).toMatchObject({ state: "open", basis: "report" });
    expect(s.reportsThisWeek).toBe(1);
  });

  it("counts reports from the last 7 days", () => {
    const s = placeStatus(range, [report(ago(HOUR)), report(ago(6 * DAY)), report(ago(8 * DAY))], SAT_2PM);
    expect(s.reportsThisWeek).toBe(2);
    expect(s.lastReportAt).toBe(ago(HOUR).toISOString());
  });
});

describe("published hours", () => {
  it("say when it closes and when it next opens", () => {
    expect(hoursNow(range.hours, SAT_2PM)).toEqual({ open: true, label: "Open until 6 PM" });
    expect(hoursNow(range.hours, new Date("2026-11-14T11:00:00Z"))).toEqual({ open: false, label: "Closed · opens 6 AM" });
  });

  it("handle hours past midnight, including Saturday into Sunday", () => {
    const late = [{ days: [6], open: "10:00", close: "02:00" }];
    expect(hoursNow(late, new Date("2026-11-15T07:30:00Z")).open).toBe(true); // Sun 1:30 AM
    expect(hoursNow(late, new Date("2026-11-15T08:30:00Z")).label).toBe("Closed · opens Sat 10 AM"); // Sun 2:30 AM
  });

  it("handle 24/7 and missing hours", () => {
    expect(hoursNow("24/7", SAT_2PM)).toEqual({ open: true, label: "Open 24/7" });
    expect(hoursNow([], SAT_2PM).open).toBe(false);
  });
});
