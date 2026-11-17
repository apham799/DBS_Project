// Everything a place publishes (hours, seasons) is in Chicago time, whatever
// time zone the server or the golfer's phone is in.

const TZ = "America/Chicago";

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ChicagoParts = {
  dateKey: string; // "2026-11-16"
  weekday: number; // 0 = Sunday
  minutes: number; // minutes since local midnight
};

export function chicagoParts(d: Date): ChicagoParts {
  const p: Record<string, string> = {};
  for (const { type, value } of partsFormat.formatToParts(d)) p[type] = value;
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    weekday: WEEKDAYS.indexOf(p.weekday),
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// "9 AM", "9:30 PM", "12 AM"
export function clockLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h24 < 12 ? "AM" : "PM"}`;
}

export const weekdayLabel = (day: number) => WEEKDAYS[((day % 7) + 7) % 7];
