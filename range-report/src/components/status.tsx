import { cx } from "@/components/ui";
import type { HoursNow } from "@/lib/hours";
import type { AreaState, AreaStatus, PlaceStatus } from "@/lib/status";

// How each area's status looks. Color, an icon and a word always go together.
// The border says how sure we are:
//   solid   a golfer reported it in the last day
//   dashed  a report from the last week ("probably")
//   dotted  a published seasonal rule or the weather
//   plain   nothing known beyond the hours

export const stateWord: Record<AreaState, string> = { open: "Open", limited: "Limited", closed: "Closed" };

const stateTone: Record<AreaState, string> = {
  open: "bg-open-tint text-open border-open",
  limited: "bg-limited-tint text-limited border-limited",
  closed: "bg-closed-tint text-closed border-closed",
};

// Shared with the summary (lib/summary.ts), so a crowd reads the same everywhere.
export { crowdWord } from "@/lib/summary";

export function StateIcon({ state, className = "size-4" }: { state: AreaState; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cx("shrink-0", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {state === "open" && <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />}
      {state === "limited" && <path d="M3.5 8 H12.5" />}
      {state === "closed" && <path d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5" />}
    </svg>
  );
}

export function AreaTile({ status, highlight }: { status: AreaStatus; highlight?: boolean }) {
  const { area, state, basis, reason, conflict } = status;
  const known = basis !== "hours";
  return (
    <li
      className={cx(
        "flex flex-col gap-2 rounded-lg border-2 p-4 transition-shadow",
        known && "min-h-28",
        known ? stateTone[state] : "border-rule bg-surface text-ink",
        basis === "likely" && "border-dashed",
        (basis === "season" || basis === "weather") && "border-dotted",
        highlight && "shadow-lift",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-heading text-ink">{area.label}</p>
        {conflict && <span className="rounded-full border border-current px-2 text-label">Reports differ</span>}
      </div>
      {/* Nothing known beyond the hours: no icon or state word. The hours badge
          at the top already says open or closed; repeating it on every tile was noise. */}
      {known ? (
        <p className="flex items-center gap-1.5 text-body font-semibold">
          <StateIcon state={state} />
          {basis === "likely" ? `Probably ${stateWord[state].toLowerCase()}` : stateWord[state]}
        </p>
      ) : (
        <span className="sr-only">{stateWord[state]} by its hours.</span>
      )}
      {reason && <p className="text-label font-normal text-muted">{reason}</p>}
    </li>
  );
}

// Open, closing within the hour, or closed, by the published hours.
export type HoursTone = "open" | "soon" | "closed";
export const hoursTone = (h: HoursNow): HoursTone => (!h.open ? "closed" : h.closingSoon ? "soon" : "open");

const hoursBadgeTone: Record<HoursTone, string> = {
  open: "border-hours-green/35 bg-hours-green/15 text-open",
  soon: "border-hours-yellow/60 bg-hours-yellow/25 text-limited",
  closed: "border-hours-red/30 bg-hours-red/12 text-hours-red-ink",
};

// A whole place card, washed with the same color very lightly.
export const hoursCardTone: Record<HoursTone, string> = {
  open: "bg-hours-green/[0.06]",
  soon: "bg-hours-yellow/[0.12]",
  closed: "bg-hours-red/[0.05]",
};

export function HoursBadge({ hours }: { hours: HoursNow }) {
  const tone = hoursTone(hours);
  return (
    <span className={cx("inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-label font-semibold", hoursBadgeTone[tone])}>
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {hours.label}
    </span>
  );
}

// One line for a place card: what's usable right now. The hours badge above it
// already says open or closed, so this is only about the areas (null when the
// place is closed: there's nothing more to say).
export function headline(s: PlaceStatus): string | null {
  if (!s.hours.open) return null;
  const count = (st: AreaState) => s.areas.filter((a) => a.state === st && a.basis !== "hours").length;
  if (s.areas.every((a) => a.state === "closed")) return "Every area closed";
  const parts = [
    count("closed") && `${count("closed")} closed`,
    count("limited") && `${count("limited")} limited`,
    count("open") && `${count("open")} reported open`,
  ].filter(Boolean);
  return parts.length ? `Areas: ${parts.join(" · ")}` : "No recent reports on the areas";
}

// A row of small chips, one per area: the place card's mini heat map.
//
// Only areas we know something about (a report, the season, the weather) get a
// color, an icon and a word. The rest are plain chips that just say the area
// exists: an ✕ on "Chipping area" at night read as "no chipping area here",
// when it only meant "the place is closed right now", which the headline
// above already says.
export function AreaDots({ status }: { status: PlaceStatus }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Areas">
      {status.areas.map((a) => {
        const known = a.basis !== "hours";
        return (
          <li
            key={a.area.id}
            className={cx(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-label",
              known ? stateTone[a.state] : "border-rule bg-surface text-muted",
              a.basis === "likely" && "border-dashed",
              (a.basis === "season" || a.basis === "weather") && "border-dotted",
            )}
          >
            {known && <StateIcon state={a.state} className="size-3.5" />}
            <span className="text-ink">{a.area.label}</span>
            {known ? (
              <span className="font-semibold">{a.basis === "likely" ? "probably " : ""}{stateWord[a.state].toLowerCase()}</span>
            ) : (
              <span className="sr-only">: no reports, {stateWord[a.state].toLowerCase()} by its hours</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Legend() {
  return (
    <details className="text-label text-muted">
      <summary className="cursor-pointer rounded-sm font-semibold text-ink">How sure is this?</summary>
      <ul className="mt-2 flex flex-col gap-1 font-normal">
        <li><span className="mr-2 inline-block h-3 w-6 rounded-sm border-2 border-ink align-middle" />Solid: a golfer reported it in the last day</li>
        <li><span className="mr-2 inline-block h-3 w-6 rounded-sm border-2 border-dashed border-ink align-middle" />Dashed: reported this week, probably still true</li>
        <li><span className="mr-2 inline-block h-3 w-6 rounded-sm border-2 border-dotted border-ink align-middle" />Dotted: the place&apos;s published season, or the weather</li>
        <li><span className="mr-2 inline-block h-3 w-6 rounded-sm border-2 border-rule align-middle" />Plain: nothing known beyond its hours</li>
      </ul>
    </details>
  );
}

// "Not enough reports yet": three empty bars. Used only for that, so it never
// gets confused with a condition (those have their own colors and icons).
export function NoDataIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cx("shrink-0", className)} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="2.5" y="11" width="3.5" height="6" rx="0.8" strokeDasharray="2 1.6" />
      <rect x="8.25" y="7" width="3.5" height="10" rx="0.8" strokeDasharray="2 1.6" />
      <rect x="14" y="3" width="3.5" height="14" rx="0.8" strokeDasharray="2 1.6" />
    </svg>
  );
}

// "● ○  1 of 2": how close a place is to having enough reports.
export function Progress({ have, need, label }: { have: number; need: number; label: string }) {
  return (
    <p className="flex items-center gap-2 text-label text-muted">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: need }, (_, i) => (
          <span key={i} className={cx("size-2.5 rounded-full border-2 border-muted", i < have && "bg-muted")} />
        ))}
      </span>
      {label}
    </p>
  );
}
