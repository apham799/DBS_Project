"use client";

import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";
import type { HoursNow } from "@/lib/hours";
import { ageLabel, type AreaState, type AreaStatus, type PlaceStatus } from "@/lib/status";
import type { AreaTrend } from "@/lib/summary";
import type { Condition } from "@/lib/types";

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

// What we know about one area, for the pop-up that opens from the facility
// map: its status now and why, the latest rating and how long ago, then every
// option with how many times it was picked in the last 30 days.

const conditionState: Record<Condition, AreaState> = { good: "open", limited: "limited", closed: "closed" };
const conditionLabel: Record<Condition, string> = { good: "Good", limited: "Limited", closed: "Closed" };
const CONDITIONS: Condition[] = ["good", "limited", "closed"];

// Ratings are data, not controls: plain colored text and a thin bar, never a
// bordered pill (pills looked like the report form's buttons and invited taps).
const conditionText: Record<Condition, string> = { good: "text-open", limited: "text-limited", closed: "text-closed" };
const conditionBar: Record<Condition, string> = { good: "bg-open", limited: "bg-limited", closed: "bg-closed" };

function Rating({ condition, count }: { condition: Condition; count?: number }) {
  // Never picked: grayed out, so the options golfers actually chose stand out.
  const none = count === 0;
  return (
    <span className={cx("inline-flex items-center gap-1", none ? "text-disabled" : conditionText[condition])}>
      <StateIcon state={conditionState[condition]} className="size-3.5" />
      <span className="font-semibold">{conditionLabel[condition]}</span>
      {count !== undefined && <span className={none ? "" : "text-ink"}>{count}</span>}
    </span>
  );
}

const stateText: Record<AreaState, string> = { open: "text-open", limited: "text-limited", closed: "text-closed" };

// "Open", "Probably limited", or null when nothing is known beyond the hours.
export function areaStateLabel(s: AreaStatus): string | null {
  if (s.basis === "hours") return null;
  return s.basis === "likely" ? `Probably ${stateWord[s.state].toLowerCase()}` : stateWord[s.state];
}

export function AreaDetails({ status, trend, now }: { status: AreaStatus; trend?: AreaTrend; now: Date }) {
  const { state, basis, reason, conflict } = status;
  const label = areaStateLabel(status);
  // With ratings to show, "Reported limited 2 h ago" would only repeat them;
  // the season or weather note, or the reason when nobody rated it, still helps.
  const note = !trend || basis === "season" || basis === "weather" ? reason : "";

  return (
    <div className="flex flex-col gap-4 text-body">
      <div className="flex flex-col gap-1">
        {label ? (
          <p className={cx("flex items-center gap-1.5 font-semibold", stateText[state])}>
            <StateIcon state={state} />
            {label}
            {conflict && <span className="ml-1 rounded-full border border-current px-2 text-label font-normal">Reports differ</span>}
          </p>
        ) : (
          // Nothing current: say why, so "Latest: Limited" below reads as the
          // last thing known, not as a contradiction.
          <p className="text-muted">{state === "closed" ? "Closed right now, by its published hours." : "Open by its hours. No current report."}</p>
        )}
        {note && <p className="text-label font-normal text-muted">{note}</p>}
        {conflict && <p className="text-label font-normal text-muted">Golfers reported different things within a few hours. The newest report is shown.</p>}
      </div>

      {trend ? (
        <div className="flex flex-col gap-2 border-t border-rule pt-4 text-label font-normal text-muted">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Latest:</span>
            <Rating condition={trend.latest} />
            <span>· updated {ageLabel(now.getTime() - new Date(trend.latestAt).getTime())}</span>
          </p>
          <span>
            Last 30 days · {trend.rated} {trend.rated === 1 ? "rating" : "ratings"}
          </span>
          {/* Share of each rating, as one thin bar. */}
          <div className="flex h-1.5 overflow-hidden rounded-full bg-rule" aria-hidden>
            {CONDITIONS.filter((c) => trend.counts[c] > 0).map((c) => (
              <span key={c} className={conditionBar[c]} style={{ width: `${(trend.counts[c] / trend.rated) * 100}%` }} />
            ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Ratings in the last 30 days">
            {CONDITIONS.map((c) => (
              <li key={c}>
                <Rating condition={c} count={trend.counts[c]} />
                <span className="sr-only">{trend.counts[c] === 0 ? " times, not reported" : trend.counts[c] === 1 ? " time" : " times"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="border-t border-rule pt-4 text-label font-normal text-muted">Nobody has rated this in the last 30 days.</p>
      )}
    </div>
  );
}

// The heat map's key: what the fills and the outlines mean.
export function MapKey() {
  const swatch = "inline-block h-4 w-7 shrink-0 rounded-sm border-2";
  return (
    <div className="flex flex-col gap-4 text-label font-normal text-muted">
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-ink">Colors</p>
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2"><span className={cx(swatch, "border-open bg-open-tint")} />Good</li>
          <li className="flex items-center gap-2"><span className={cx(swatch, "border-limited bg-limited-tint")} />Limited: usable, not normal</li>
          <li className="flex items-center gap-2"><span className={cx(swatch, "border-closed bg-closed-tint")} />Closed</li>
          <li className="flex items-center gap-2"><span className={cx(swatch, "border-edge/40 bg-surface")} />No current report</li>
          <li className="flex items-center gap-2"><span className={cx(swatch, "border-limited bg-limited-tint opacity-55")} />Faded: last known, while the place is closed</li>
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-semibold text-ink">How sure</p>
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2"><span className={cx(swatch, "border-ink")} />Solid: reported in the last day</li>
          <li className="flex items-center gap-2"><span className={cx(swatch, "border-dashed border-ink")} />Dashed: this week, probably still true</li>
          <li className="flex items-center gap-2"><span className={cx(swatch, "border-dotted border-ink")} />Dotted: published season, or the weather</li>
        </ul>
      </div>
      <p>Tap an area on the map for its reports.</p>
    </div>
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

// "How sure is this?" opens as a small floating panel over the page instead
// of pushing everything below it down. Esc or a click anywhere else closes it.
export function Legend() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const outside = (e: PointerEvent) => el.open && !el.contains(e.target as Node) && (el.open = false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !el.open) return;
      el.open = false;
      el.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, []);

  return (
    <details ref={ref} className="relative text-label text-muted">
      <summary className="cursor-pointer rounded-sm font-semibold text-ink">How sure is this?</summary>
      <ul className="absolute left-0 top-full z-20 mt-2 flex w-max max-w-[calc(100vw-2rem)] flex-col gap-1.5 rounded-lg border border-rule bg-surface p-4 font-normal shadow-lift">
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
