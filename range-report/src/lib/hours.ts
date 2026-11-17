import { chicagoParts, clockLabel, toMinutes, weekdayLabel } from "./chicago-time";
import type { Place } from "./types";

const WEEK = 7 * 1440;

// closingSoon: open now, but closes within CLOSING_SOON_MIN minutes.
export type HoursNow = { open: boolean; closingSoon: boolean; label: string };

export const CLOSING_SOON_MIN = 60;

// Is the place open right now by its published hours, and what should we say?
// Works in "minutes since Sunday midnight, Chicago time" so overnight hours
// (close before open) and the Saturday → Sunday wrap need no special dates.
export function hoursNow(hours: Place["hours"], now: Date): HoursNow {
  if (hours === "24/7") return { open: true, closingSoon: false, label: "Open 24/7" };
  if (hours.length === 0) return { open: false, closingSoon: false, label: "Hours not published" };

  const { weekday, minutes } = chicagoParts(now);
  const t = weekday * 1440 + minutes;

  const intervals: { start: number; end: number }[] = [];
  for (const rule of hours) {
    const open = toMinutes(rule.open);
    let close = toMinutes(rule.close);
    if (close <= open) close += 1440; // runs past midnight
    for (const day of rule.days) {
      const start = day * 1440 + open;
      // Each interval also appears a week earlier and later, to cover the wrap.
      for (const shift of [-WEEK, 0, WEEK]) {
        intervals.push({ start: start + shift, end: start + (close - open) + shift });
      }
    }
  }

  const current = intervals.find((i) => i.start <= t && t < i.end);
  if (current) {
    const left = current.end - t;
    return left <= CLOSING_SOON_MIN
      ? { open: true, closingSoon: true, label: `Closes in ${left} min · ${clockLabel(current.end)}` }
      : { open: true, closingSoon: false, label: `Open until ${clockLabel(current.end)}` };
  }

  const next = intervals.filter((i) => i.start > t).sort((a, b) => a.start - b.start)[0];
  if (!next) return { open: false, closingSoon: false, label: "Closed" };
  const sameDay = Math.floor(next.start / 1440) === Math.floor(t / 1440);
  const day = weekdayLabel(Math.floor(next.start / 1440));
  return { open: false, closingSoon: false, label: `Closed · opens ${sameDay ? "" : `${day} `}${clockLabel(next.start)}` };
}
