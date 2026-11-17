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

export type AreaState = "open" | "limited" | "closed";
export type Basis = "report" | "likely" | "weather" | "season" | "hours";

export type AreaStatus = {
  area: Area;
  state: AreaState;
  basis: Basis;
  reason: string;
  reportedAt: string | null; // the report this is based on, if any
  conflict: boolean; // a report shortly before it disagreed
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

// What a report says about one area, or undefined if it says nothing.
function valueFor(report: Report, areaId: string): Condition | undefined {
  if (!report.placeOpen) return "closed";
  return report.areas[areaId];
}

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
    return { ...known, state: "closed", basis: "hours", reason };
  }

  if (area.outdoor && weather?.stormNow) {
    return { ...base, state: "closed", basis: "weather", reason: "Thunderstorm nearby: outdoor areas usually close" };
  }

  const today = chicagoParts(now).dateKey;
  const season = activeSeason(place, area.id, today);
  const latest = reports.find((r) => valueFor(r, area.id) !== undefined);

  if (latest) {
    const value = valueFor(latest, area.id)!;
    const created = new Date(latest.createdAt);
    const age = now.getTime() - created.getTime();
    const ago = ageLabel(age);
    const createdDay = chicagoParts(created).dateKey;
    const beforeSeason = season !== undefined && createdDay < season.from;

    const conflict = reports.some(
      (r) =>
        r !== latest &&
        created.getTime() - new Date(r.createdAt).getTime() <= WINDOWS.conflict &&
        new Date(r.createdAt) <= created &&
        valueFor(r, area.id) !== undefined &&
        valueFor(r, area.id) !== value,
    );
    const fromReport = (state: AreaState, basis: Basis, reason: string): AreaStatus => ({
      area,
      state,
      basis,
      reason,
      reportedAt: latest.createdAt,
      conflict,
    });

    if (!beforeSeason) {
      if (!latest.placeOpen) {
        // An unexpected closure ("closed for maintenance") holds for that day only.
        if (createdDay === today) return fromReport("closed", "report", `Reported closed today, ${ago}`);
      } else if (value === "good") {
        if (age < WINDOWS.good) return fromReport("open", "report", `Reported good ${ago}`);
      } else if (age < WINDOWS.problemFresh) {
        return fromReport(stateOf[value], "report", `Reported ${conditionWord[value]} ${ago}`);
      } else if (age < WINDOWS.problem) {
        return fromReport(stateOf[value], "likely", `Probably still ${conditionWord[value]}: reported ${ago}`);
      }
    }
  }

  if (season) return { ...base, state: season.condition, basis: "season", reason: season.note };

  return { ...base, state: "open", basis: "hours", reason: lastReport(reports, area, now) };
}

// For an area nothing current is known about: "Last report 9 days ago", or ""
// if it's never been reported (the tile then just names the area; saying
// "no reports yet" on every tile repeated what the summary card already says).
function lastReport(reports: Report[], area: Area, now: Date): string {
  const latest = reports.find((r) => valueFor(r, area.id) !== undefined);
  return latest ? `Last report ${ageLabel(now.getTime() - new Date(latest.createdAt).getTime())}` : "";
}

export function placeStatus(place: Place, allReports: Report[], now: Date, weather: WeatherNow = null): PlaceStatus {
  const reports = allReports
    .filter((r) => r.placeId === place.id && new Date(r.createdAt) <= now)
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
