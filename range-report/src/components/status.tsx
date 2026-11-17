import { cx } from "@/components/ui";
import type { AreaState, AreaStatus, PlaceStatus } from "@/lib/status";
import type { Crowd } from "@/lib/types";

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

export const crowdWord: Record<Crowd, string> = { quiet: "Walk right in", some_wait: "Short wait", busy: "Packed" };

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
        "flex min-h-28 flex-col gap-2 rounded-lg border-2 p-4 transition-shadow",
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
      <p className="flex items-center gap-1.5 text-body font-semibold">
        <StateIcon state={state} />
        {basis === "likely" ? `Probably ${stateWord[state].toLowerCase()}` : stateWord[state]}
        {!known && <span className="font-normal text-muted">· by its hours</span>}
      </p>
      <p className="text-label font-normal text-muted">{reason}</p>
    </li>
  );
}

// One line for a place card: what's usable right now.
export function headline(s: PlaceStatus): string {
  if (!s.hours.open) return s.hours.label;
  const count = (st: AreaState) => s.areas.filter((a) => a.state === st && a.basis !== "hours").length;
  const closed = s.areas.filter((a) => a.state === "closed").length;
  if (closed === s.areas.length) return "Everything closed";
  const parts = [
    count("closed") && `${count("closed")} closed`,
    count("limited") && `${count("limited")} limited`,
    count("open") && `${count("open")} reported open`,
  ].filter(Boolean);
  return parts.length ? `Open · ${parts.join(" · ")}` : `${s.hours.label} · no recent reports`;
}

// A row of small squares, one per area: the place card's mini heat map.
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
            <StateIcon state={a.state} className="size-3.5" />
            <span className="text-ink">{a.area.label}</span>
            <span className="sr-only">: {a.basis === "likely" ? "probably " : ""}{stateWord[a.state]}{known ? "" : " by its hours"}</span>
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
