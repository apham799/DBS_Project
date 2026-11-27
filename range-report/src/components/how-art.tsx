import { StateIcon } from "@/components/status";
import { cx } from "@/components/ui";

// Illustrations for the How it works page. Pure SVG and CSS (animations in
// globals.css, all off for reduced motion, where each shows its final state).

// The banner: a putt rolling along its line into the cup, on a loop.
export function PuttScene() {
  const line = "M70 250 C 170 200, 300 260, 430 196";
  return (
    <svg viewBox="0 0 520 320" className="h-auto w-full" aria-hidden>
      <defs>
        <radialGradient id="putt-green" cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#8fc293" />
          <stop offset="1" stopColor="#5f9a68" />
        </radialGradient>
      </defs>
      {/* Soft drifting shapes behind the green. */}
      <circle className="rr-drift" cx="430" cy="70" r="54" fill="#b8893b" opacity="0.18" />
      <circle className="rr-drift-slow" cx="90" cy="80" r="70" fill="#2f6b4f" opacity="0.08" />
      {/* The green and its fringe. */}
      <ellipse cx="260" cy="226" rx="250" ry="86" fill="#4f8a63" />
      <ellipse cx="260" cy="222" rx="232" ry="76" fill="url(#putt-green)" />
      {/* The line of the putt. */}
      <path d={line} fill="none" stroke="#f8f2e4" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" opacity="0.85" />
      {/* Cup and flag. */}
      <ellipse cx="432" cy="197" rx="13" ry="5" fill="#16362a" />
      <line x1="432" y1="196" x2="432" y2="92" stroke="#2b2a28" strokeWidth="3" strokeLinecap="round" />
      <path d="M432 94 L 482 110 L 432 126 Z" fill="#b8893b" />
      {/* The ball: rolling with motion, resting at the cup without. */}
      <g className="motion-reduce:hidden">
        <circle r="8" fill="#ffffff" stroke="#e6dcc4" strokeWidth="1.5">
          <animateMotion dur="4.5s" repeatCount="indefinite" path={line} keyPoints="0;1;1" keyTimes="0;0.72;1" calcMode="spline" keySplines="0.2 0.6 0.4 1;0 0 1 1" />
          <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.74;0.8;1" dur="4.5s" repeatCount="indefinite" />
        </circle>
      </g>
      <circle className="hidden motion-reduce:inline" cx="412" cy="200" r="8" fill="#ffffff" stroke="#e6dcc4" strokeWidth="1.5" />
    </svg>
  );
}

const panel = "rounded-2xl border border-cream-deep bg-cream p-5 sm:p-6";

// Step 1: a place as it appears in the list.
export function CardArt() {
  const chip = "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-label";
  return (
    <div className={panel} aria-hidden>
      <div className="flex flex-col gap-3 rounded-lg border border-rule bg-surface p-4 shadow-card">
        <p className="font-display text-xl font-semibold">Harborside Practice Facility</p>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-hours-green/35 bg-hours-green/15 px-3 py-1 text-label font-semibold text-open">
          <span className="relative flex size-2">
            <span className="rr-ping absolute inset-0 rounded-full bg-current" />
            <span className="relative size-2 rounded-full bg-current" />
          </span>
          Open until 6 PM
        </span>
        <div className="flex flex-wrap gap-1.5">
          <span className={cx(chip, "border-open bg-open-tint text-open")}>
            <StateIcon state="open" className="size-3.5" />
            <span className="text-ink">Range</span> <span className="font-semibold">open</span>
          </span>
          <span className={cx(chip, "border-limited bg-limited-tint text-limited")}>
            <StateIcon state="limited" className="size-3.5" />
            <span className="text-ink">Short game</span> <span className="font-semibold">limited</span>
          </span>
          <span className={cx(chip, "border-rule bg-surface text-muted")}>
            <span className="text-ink">Putting green</span>
          </span>
        </div>
        <p className="text-label text-muted">Golfer report: 2 h ago</p>
      </div>
    </div>
  );
}

// Step 2: the facility map, with the short game area's color changing as
// reports come in.
export function MapArt() {
  return (
    <div className={panel} aria-hidden>
      <svg viewBox="0 0 400 220" className="h-auto w-full rounded-lg bg-surface">
        <rect x="10" y="10" width="250" height="200" rx="12" className="fill-open-tint stroke-open" strokeWidth="2.5" />
        <text x="135" y="104" textAnchor="middle" className="fill-ink text-[15px] font-semibold">Range</text>
        <text x="135" y="124" textAnchor="middle" className="fill-open text-[13px] font-semibold">open</text>
        <path d="M60 196 A 80 80 0 0 1 210 196" fill="none" className="stroke-ink/15" strokeWidth="1.5" strokeDasharray="5 5" />
        <rect x="274" y="10" width="116" height="118" rx="20" className="rr-cycle fill-limited-tint stroke-limited" strokeWidth="2.5" />
        <text x="332" y="64" textAnchor="middle" className="fill-ink text-[13px] font-semibold">Short game</text>
        <ellipse cx="332" cy="174" rx="56" ry="34" className="fill-surface stroke-edge/40" strokeWidth="2" strokeDasharray="10 6" />
        <text x="332" y="178" textAnchor="middle" className="fill-ink text-[13px] font-semibold">Putting</text>
        {/* A finger tapping the short game area. */}
        <g transform="translate(350 92)">
          <circle className="rr-ping fill-green/30" r="10" />
          <circle r="5" className="fill-green" />
        </g>
      </svg>
    </div>
  );
}

// Step 3: the three taps, lighting up in turn, then "Posted".
export function TapsArt() {
  const pill = "rr-tap inline-flex h-9 items-center rounded-md border-2 border-green bg-green px-3 text-label font-semibold text-on-green";
  const row = (q: string, a: string, n: 1 | 2 | 3) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-body text-ink">{q}</span>
      <span className={cx(pill, n === 2 && "rr-tap-2", n === 3 && "rr-tap-3")}>{a}</span>
    </div>
  );
  return (
    <div className={panel} aria-hidden>
      <div className="flex flex-col gap-3 rounded-lg border border-rule bg-surface p-4 shadow-card">
        {row("Was it open?", "Yes", 1)}
        {row("Short game area", "Limited", 2)}
        {row("How busy?", "Walk right in", 3)}
        <p className="rr-posted flex items-center gap-1.5 border-t border-rule pt-3 text-label font-semibold text-open">
          <StateIcon state="open" className="size-4" />
          Posted. Thanks for telling everyone.
        </p>
      </div>
    </div>
  );
}
