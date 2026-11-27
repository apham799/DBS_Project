// The combined status: what Range Report says about each area of a place right
// now. It mixes four sources, from most to least authoritative:
//
//   1. Published hours: if the place is closed by its hours, everything is.
//   2. Weather: a thunderstorm closes outdoor areas.
//   3. The newest report about the area, which goes stale at a speed that
//      depends on what it says (see the windows below).
//   4. A published seasonal rule ("closes for winter Nov 16").
//
// If none of those says anything, the area is open by its hours, with no
// recent report. A report filed before a seasonal rule started never overrides it.

import { chicagoParts } from "./chicago-time";
import { hoursNow, type HoursNow } from "./hours";
import type { Area, Condition, Crowd, Place, Report, SeasonRule } from "./types";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// How long each kind of report is worth trusting.
export const WINDOWS = {
  good: DAY, // "chipping is fine": a day, then fall back to hours
  problem: 7 * DAY, // "chipping closed / limited": problems last
  problemFresh: DAY, // …but after a day we only say "probably"
  crowd: 2 * HOUR, // "busy": a few hours at most
  conflict: 3 * HOUR, // two reports this close together that disagree
} as const;

// How far "in the future" a report may be and still count. Report times come
// from the database's clock, `now` from the browser's, which ticks every 30 s
// and can run a little slow. Without this, a report posted a few seconds ago
// (yours, or one arriving live) was ignored until the browser clock caught up.
// Further ahead than this is a bad clock or bad data, and is still ignored.
export const CLOCK_SKEW = 5 * 60_000;

// "Now" for computing statuses: the browser clock, but never earlier than the
// newest report we've seen. Report times come from the database's clock, so a
// report "from the future" means this device's clock is behind; trusting the
// report keeps the status, the ages and the recent-reports list in agreement.
export function effectiveNow(now: Date, reports: Report[]): Date {
  let newest = now.getTime();
  for (const r of reports) newest = Math.max(newest, new Date(r.createdAt).getTime());
  return newest === now.getTime() ? now : new Date(newest);
}

export type AreaState = "open" | "limited" | "closed";
// confirmed: a status an admin confirmed from golfers' reports.
export type Basis = "report" | "likely" | "weather" | "confirmed" | "season" | "hours";

export type AreaStatus = {
  area: Area;
  state: AreaState;
  basis: Basis;
  reason: string;
  reportedAt: string | null; // the report this is based on, if any
  conflict: boolean; // a report shortly before it disagreed
  wholePlace?: boolean; // basis "confirmed": the admin set the whole place, not just this area
  // While the place is closed by its hours: what this area would show if it
  // were open (a report, the season), so the map can still say "last known".
  lastKnown?: { state: AreaState; basis: Exclude<Basis, "hours">; wholePlace?: boolean } | null;
};

export type PlaceStatus = {
  hours: HoursNow;
  areas: AreaStatus[];
  crowd: { level: Crowd; reportedAt: string; age: string } | null;
  lastReportAt: string | null;
  reportsThisWeek: number;
};

export type WeatherNow = { stormNow: boolean } | null;

const stateOf: Record<Condition, AreaState> = { good: "open", limited: "limited", closed: "closed" };
const conditionWord: Record<Condition, string> = { good: "good", limited: "limited", closed: "closed" };

export function ageLabel(ms: number): string {
  const min = Math.max(1, Math.floor(ms / 60000));
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

function activeSeason(place: Place, areaId: string, dateKey: string): SeasonRule | undefined {
  return place.seasons.find(
    (s) => s.from <= dateKey && (!s.to || dateKey <= s.to) && (!s.areas || s.areas.includes(areaId)),
  );
}

// A golfer who found it working after a season began shows the published rule
// is wrong (Harborside's "projected" Nov 16 closure, reported open on Nov 17).
// From then on the rule is ignored, even once that report is too old to show:
// "a golfer's report always beats published info". A closure of the whole
// place is contradicted by any open report; a closure of one area by that area
// rated good or limited; a "limited" season (mats only) only by "good".
function contradicted(season: SeasonRule, area: Area, reports: Report[]): boolean {
  return reports.some((r) => {
    if (!r.placeOpen || chicagoParts(new Date(r.createdAt)).dateKey < season.from) return false;
    const rating = r.areas[area.id];
    if (season.condition === "limited") return rating === "good";
    return season.areas ? rating === "good" || rating === "limited" : true;
  });
}

// What a report says about one area, or undefined if it says nothing.
// The "golf day" a moment belongs to: the Chicago date, rolling over at 4 AM
// rather than midnight, so a "closed for a private event" report at 11:30 PM
// at a place open until 1 AM still holds at 12:30.
const GOLF_DAY_STARTS = 4 * HOUR;
const golfDay = (d: Date) => chicagoParts(new Date(d.getTime() - GOLF_DAY_STARTS)).dateKey;

function areaStatus(
  place: Place,
  area: Area,
  reports: Report[], // newest first, this place only, none in the future
  now: Date,
  hours: HoursNow,
  weather: WeatherNow,
): AreaStatus {
  const base = { area, reportedAt: null, conflict: false };

  // Closed by its hours: the whole place is closed, which the hours badge
  // already says. The reason says what's known about this area for when it
  // reopens instead ("Reported good 2 h ago", the season), not "closed" again.
  if (!hours.open) {
    const known = areaStatus(place, area, reports, now, { ...hours, open: true }, null);
    const reason = known.basis === "hours" ? lastReport(reports, area, now) : known.reason;
    const lastKnown = known.basis === "hours" ? null : { state: known.state, basis: known.basis, wholePlace: known.wholePlace };
    return { ...known, state: "closed", basis: "hours", reason, lastKnown };
  }

  if (area.outdoor && weather?.stormNow) {
    return { ...base, state: "closed", basis: "weather", reason: "Thunderstorm nearby: outdoor areas usually close" };
  }

  const today = chicagoParts(now).dateKey;
  const season = activeSeason(place, area.id, today);
  const beforeSeason = (r: Report) => season !== undefined && chicagoParts(new Date(r.createdAt)).dateKey < season.from;

  // 1. "Closed when I got there" covers every area, but only while it's the
  //    latest word on the place: for the same golf day, and until anyone
  //    reports it open again (a frost delay that lifts at 11 shouldn't keep
  //    the putting green "closed" all day just because the 11 AM report
  //    only rated the range).
  const closure = reports.find((r) => !r.placeOpen);
  if (closure && !beforeSeason(closure)) {
    const reopened = reports.some((r) => r.placeOpen && r.createdAt > closure.createdAt);
    if (!reopened && golfDay(new Date(closure.createdAt)) === golfDay(now)) {
      return {
        area,
        state: "closed",
        basis: "report",
        reason: `Reported closed today, ${ageLabel(now.getTime() - new Date(closure.createdAt).getTime())}`,
        reportedAt: closure.createdAt,
        conflict: false,
      };
    }
  }

  // 2. Otherwise the newest explicit rating of this area. Closure reports say
  //    nothing about a single area, so they never hide an older rating (an
  //    expired closure used to wipe out "chipping roped off" from the day before).
  const latest = reports.find((r) => r.placeOpen && r.areas[area.id] !== undefined);

  if (latest && !beforeSeason(latest)) {
    const value = latest.areas[area.id];
    const created = new Date(latest.createdAt);
    const age = now.getTime() - created.getTime();
    const ago = ageLabel(age);

    // Two ratings of this area close together that disagree. (A closure
    // followed by "open, range good" is a change, not a disagreement.)
    const conflict = reports.some(
      (r) =>
        r !== latest &&
        r.placeOpen &&
        r.areas[area.id] !== undefined &&
        r.areas[area.id] !== value &&
        new Date(r.createdAt) <= created &&
        created.getTime() - new Date(r.createdAt).getTime() <= WINDOWS.conflict,
    );
    const fromReport = (state: AreaState, basis: Basis, reason: string): AreaStatus => ({
      area,
      state,
      basis,
      reason,
      reportedAt: latest.createdAt,
      conflict,
    });

    if (value === "good") {
      if (age < WINDOWS.good) return fromReport("open", "report", `Reported good ${ago}`);
    } else if (age < WINDOWS.problemFresh) {
      return fromReport(stateOf[value], "report", `Reported ${conditionWord[value]} ${ago}`);
    } else if (age < WINDOWS.problem) {
      return fromReport(stateOf[value], "likely", `Probably still ${conditionWord[value]}: reported ${ago}`);
    }
  }

  // An admin's confirmed status: below a fresh golfer report (checked above),
  // above any published season (checked below). One for this area beats one
  // for the whole place.
  const inEffect = (place.confirmed ?? []).filter((c) => c.startsOn <= today && (!c.endsOn || today <= c.endsOn));
  const confirmed = inEffect.find((c) => c.areaId === area.id) ?? inEffect.find((c) => c.areaId === null);
  if (confirmed) {
    return {
      ...base,
      state: confirmed.condition === "open" ? "open" : confirmed.condition,
      basis: "confirmed",
      reason: `${confirmed.note} · set by a Range Report admin`,
      wholePlace: confirmed.areaId === null,
    };
  }

  if (season && !contradicted(season, area, reports)) return { ...base, state: season.condition, basis: "season", reason: season.note };
  if (season) {
    const last = lastReport(reports, area, now);
    return { ...base, state: "open", basis: "hours", reason: `Golfers found it open after the published "${season.note}"${last ? ` · ${last.toLowerCase()}` : ""}` };
  }

  return { ...base, state: "open", basis: "hours", reason: lastReport(reports, area, now) };
}

// For an area nothing current is known about: "Last report 9 days ago", or ""
// if it's never been reported (the tile then just names the area; saying
// "no reports yet" on every tile repeated what the summary card already says).
function lastReport(reports: Report[], area: Area, now: Date): string {
  const latest = reports.find((r) => r.placeOpen && r.areas[area.id] !== undefined);
  return latest ? `Last report ${ageLabel(now.getTime() - new Date(latest.createdAt).getTime())}` : "";
}

export function placeStatus(place: Place, allReports: Report[], now: Date, weather: WeatherNow = null): PlaceStatus {
  const reports = allReports
    .filter((r) => r.placeId === place.id && new Date(r.createdAt).getTime() <= now.getTime() + CLOCK_SKEW)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const hours = hoursNow(place.hours, now);
  const areas = place.areas.map((a) => areaStatus(place, a, reports, now, hours, weather));

  const crowdReport = hours.open
    ? reports.find((r) => r.crowd !== null && now.getTime() - new Date(r.createdAt).getTime() < WINDOWS.crowd)
    : undefined;
  const crowd = crowdReport
    ? {
        level: crowdReport.crowd!,
        reportedAt: crowdReport.createdAt,
        age: ageLabel(now.getTime() - new Date(crowdReport.createdAt).getTime()),
      }
    : null;

  return {
    hours,
    areas,
    crowd,
    lastReportAt: reports[0]?.createdAt ?? null,
    reportsThisWeek: reports.filter((r) => now.getTime() - new Date(r.createdAt).getTime() < 7 * DAY).length,
  };
}
