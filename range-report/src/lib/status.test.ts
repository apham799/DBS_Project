import { describe, expect, it } from "vitest";
import { hoursNow } from "./hours";
import { CLOCK_SKEW, effectiveNow, placeStatus, WINDOWS } from "./status";
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
    expect(area(s, "range").reason).toBe("Last report 4 days ago");
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
    expect(area(s, "putting")).toMatchObject({ state: "open", basis: "hours", reason: "" });
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

  it("stop counting once a golfer found it open after it started, even after that report expires", () => {
    // Harborside: a projected whole-place closure from Nov 16, but golfers found it open (mats only) on Nov 17.
    const harborside: Place = { ...range, seasons: [{ from: "2026-11-16", condition: "closed", note: "Projected closed for the season" }] };
    const nov17 = report(new Date("2026-11-17T18:00:00Z"), { areas: { range: "limited" } });
    const nov27 = new Date("2026-11-27T20:00:00Z"); // ten days later: the report itself has expired
    const s = placeStatus(harborside, [nov17], nov27);
    expect(area(s, "range")).toMatchObject({ state: "open", basis: "hours" });
    expect(area(s, "putting")).toMatchObject({ state: "open", basis: "hours" }); // whole-place closure: every area
    expect(area(s, "range").reason).toContain("Golfers found it open after the published");
    // With no such report, the published closure still stands.
    expect(area(placeStatus(harborside, [], nov27), "range")).toMatchObject({ state: "closed", basis: "season" });
    // "Closed when I got there" doesn't contradict a closure.
    expect(area(placeStatus(harborside, [report(new Date("2026-11-17T18:00:00Z"), { placeOpen: false })], nov27), "range").basis).toBe("season");
  });

  it("for 'limited' seasons, only a 'good' rating contradicts them", () => {
    const mats: Place = { ...range, seasons: [{ from: "2026-11-01", areas: ["range"], condition: "limited", note: "Mats only" }] };
    const later = new Date("2026-11-27T20:00:00Z");
    expect(area(placeStatus(mats, [report(new Date("2026-11-10T18:00:00Z"), { areas: { range: "limited" } })], later), "range").basis).toBe("season");
    expect(area(placeStatus(mats, [report(new Date("2026-11-10T18:00:00Z"), { areas: { range: "good" } })], later), "range")).toMatchObject({ state: "open", basis: "hours" });
  });

  it("are overridden by a golfer who was there after it started", () => {
    const s = placeStatus(seasonal, [report(ago(HOUR, tuesday), { areas: { chipping: "limited" } })], tuesday);
    expect(area(s, "chipping")).toMatchObject({ state: "limited", basis: "report" });
  });
});

describe("confirmed statuses (set by an admin)", () => {
  const tuesday = new Date("2026-11-17T20:00:00Z");
  const withRule = (c: Partial<NonNullable<Place["confirmed"]>[number]> = {}): Place => ({
    ...range,
    seasons: [{ from: "2026-11-01", condition: "closed", note: "Closed for the season" }],
    confirmed: [{ id: "c1", areaId: "range", condition: "limited", note: "Mats only", startsOn: "2026-11-16", endsOn: null, ...c }],
  });

  it("rank above a published season", () => {
    const s = placeStatus(withRule(), [], tuesday);
    expect(area(s, "range")).toMatchObject({ state: "limited", basis: "confirmed", reason: "Mats only · confirmed by Range Report" });
    expect(area(s, "putting")).toMatchObject({ state: "closed", basis: "season" }); // only the area it names
  });

  it("rank below a fresh golfer report", () => {
    const s = placeStatus(withRule(), [report(ago(HOUR, tuesday), { areas: { range: "good" } })], tuesday);
    expect(area(s, "range")).toMatchObject({ state: "open", basis: "report" });
  });

  it("can confirm a place open, covering the whole place, and only between their dates", () => {
    const open = withRule({ areaId: null, condition: "open", note: "Open, mats only" });
    expect(placeStatus(open, [], tuesday).areas.every((a) => a.state === "open" && a.basis === "confirmed")).toBe(true);
    expect(area(placeStatus(withRule({ startsOn: "2026-11-20" }), [], tuesday), "range").basis).toBe("season");
    expect(area(placeStatus(withRule({ endsOn: "2026-11-16" }), [], tuesday), "range").basis).toBe("season");
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

  it("never lets 'now' fall behind the newest report (a slow device clock)", () => {
    const tenMinAhead = report(ago(-10 * 60_000), { areas: { chipping: "closed" } });
    const now = effectiveNow(SAT_2PM, [tenMinAhead, report(ago(HOUR))]);
    expect(now.toISOString()).toBe(tenMinAhead.createdAt);
    expect(area(placeStatus(range, [tenMinAhead], now), "chipping")).toMatchObject({ state: "closed", basis: "report" });
    expect(effectiveNow(SAT_2PM, [report(ago(HOUR))])).toBe(SAT_2PM);
  });

  it("ends a closure for every area as soon as someone reports the place open", () => {
    // Frost delay: "closed" at 9, then "open, range good" at 11 that skips the other areas.
    const closed9 = report(ago(5 * HOUR), { placeOpen: false });
    const open11 = report(ago(3 * HOUR), { areas: { range: "good" } });
    const s = placeStatus(range, [open11, closed9], SAT_2PM);
    expect(area(s, "range")).toMatchObject({ state: "open", basis: "report", conflict: false });
    expect(area(s, "putting")).toMatchObject({ state: "open", basis: "hours" }); // not "closed today"
  });

  it("doesn't let an expired closure hide an older rating of an area", () => {
    // Thursday: chipping roped off. Friday: closed when they got there. Saturday: probably still roped off.
    const thu = report(ago(2 * DAY), { areas: { chipping: "closed" } });
    const fri = report(ago(DAY), { placeOpen: false });
    const s = placeStatus(range, [fri, thu], SAT_2PM);
    expect(area(s, "chipping")).toMatchObject({ state: "closed", basis: "likely" });
    expect(area(s, "range")).toMatchObject({ state: "open", basis: "hours" });
  });

  it("keeps a late-night closure past midnight at a place open late", () => {
    const late: Place = { ...range, hours: [{ days: [5], open: "06:00", close: "01:00" }] }; // Fri 6 AM – 1 AM
    const fri1130pm = new Date("2026-11-14T05:30:00Z"); // Fri Nov 13, 11:30 PM Chicago
    const closure = report(fri1130pm, { placeOpen: false });
    const sat1230am = new Date("2026-11-14T06:30:00Z"); // still Friday's session
    expect(area(placeStatus(late, [closure], sat1230am), "range")).toMatchObject({ state: "closed", basis: "report" });
    // Next golf day (after 4 AM) it no longer applies.
    const sat10am = new Date("2026-11-14T16:00:00Z");
    expect(area(placeStatus(range, [closure], sat10am), "range").basis).toBe("hours");
  });

  it("counts a report a few minutes 'ahead' of the browser clock (just posted)", () => {
    // The browser clock ticks every 30 s and can run slow; the report's time is the database's.
    const justPosted = report(ago(-40_000), { areas: { chipping: "closed" } }); // 40 s "ahead"
    const s = placeStatus(range, [justPosted, report(ago(HOUR), { areas: { chipping: "good" } })], SAT_2PM);
    expect(area(s, "chipping")).toMatchObject({ state: "closed", basis: "report", reason: "Reported closed 1 min ago" });
    // Far ahead is a bad clock or bad data: still ignored.
    const wayAhead = report(ago(-(CLOCK_SKEW + 60_000)), { areas: { chipping: "closed" } });
    expect(area(placeStatus(range, [wayAhead], SAT_2PM), "chipping").basis).toBe("hours");
  });

  it("counts reports from the last 7 days", () => {
    const s = placeStatus(range, [report(ago(HOUR)), report(ago(6 * DAY)), report(ago(8 * DAY))], SAT_2PM);
    expect(s.reportsThisWeek).toBe(2);
    expect(s.lastReportAt).toBe(ago(HOUR).toISOString());
  });
});

describe("published hours", () => {
  it("say when it closes and when it next opens", () => {
    expect(hoursNow(range.hours, SAT_2PM)).toEqual({ open: true, closingSoon: false, label: "Open until 6 PM" });
    expect(hoursNow(range.hours, new Date("2026-11-14T11:00:00Z"))).toEqual({ open: false, closingSoon: false, label: "Closed · opens 6 AM" });
  });

  it("when the place is closed, say what's known about each area instead of 'closed' again", () => {
    const night = new Date("2026-11-15T04:00:00Z"); // Sat 10 PM, closed since 6
    const r = { id: "n1", placeId: range.id, createdAt: new Date(night.getTime() - 5 * HOUR).toISOString(), placeOpen: true, areas: { range: "good" as const, chipping: "closed" as const }, crowd: null };
    const s = placeStatus(range, [r], night);
    expect(s.areas.every((a) => a.state === "closed" && a.basis === "hours")).toBe(true);
    expect(area(s, "range").reason).toBe("Reported good 5 h ago");
    expect(area(s, "chipping").reason).toBe("Reported closed 5 h ago");
    expect(area(s, "putting").reason).toBe("");
    // What each area would show if it were open, for the map's "last known".
    expect(area(s, "range").lastKnown).toEqual({ state: "open", basis: "report" });
    expect(area(s, "chipping").lastKnown).toEqual({ state: "closed", basis: "report" });
    expect(area(s, "putting").lastKnown).toBeNull();
  });

  it("say when a place closes within the hour", () => {
    // Closes at 6 PM Chicago = 00:00 UTC Nov 15.
    expect(hoursNow(range.hours, new Date("2026-11-14T22:59:00Z"))).toMatchObject({ open: true, closingSoon: false }); // 4:59, 61 min left
    expect(hoursNow(range.hours, new Date("2026-11-14T23:00:00Z"))).toEqual({ open: true, closingSoon: true, label: "Closes in 60 min · 6 PM" });
    expect(hoursNow(range.hours, new Date("2026-11-14T23:45:00Z")).label).toBe("Closes in 15 min · 6 PM");
    expect(hoursNow(range.hours, new Date("2026-11-15T00:00:00Z"))).toMatchObject({ open: false, closingSoon: false }); // 6 PM sharp
    // Overnight hours count down across midnight; 24/7 never closes.
    const late = [{ days: [6], open: "10:00", close: "01:00" }];
    expect(hoursNow(late, new Date("2026-11-15T06:30:00Z"))).toMatchObject({ open: true, closingSoon: true }); // Sun 12:30 AM
    expect(hoursNow("24/7", new Date("2026-11-15T05:59:00Z")).closingSoon).toBe(false);
  });

  it("handle hours past midnight, including Saturday into Sunday", () => {
    const late = [{ days: [6], open: "10:00", close: "02:00" }];
    expect(hoursNow(late, new Date("2026-11-15T07:30:00Z")).open).toBe(true); // Sun 1:30 AM
    expect(hoursNow(late, new Date("2026-11-15T08:30:00Z")).label).toBe("Closed · opens Sat 10 AM"); // Sun 2:30 AM
  });

  it("handle 24/7 and missing hours", () => {
    expect(hoursNow("24/7", SAT_2PM)).toEqual({ open: true, closingSoon: false, label: "Open 24/7" });
    expect(hoursNow([], SAT_2PM).open).toBe(false);
  });
});
