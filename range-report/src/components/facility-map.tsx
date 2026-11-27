"use client";

import { useCallback, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import type { AreaStatus, PlaceStatus } from "@/lib/status";
import type { AreaKind, ConfirmedRule, Place } from "@/lib/types";
import { AdminStar, starPath, stateWord } from "@/components/status";

// The facility heat map (Lauren's idea): a sketch of the place with each area
// filled by its status right now, using the same colors and "how sure"
// outlines as the area rows (solid = reported today, dashed = probably,
// dotted = season or weather, plain white = nothing known). Stars mean an
// admin set it: along an area's outline for that area, around the whole
// sketch for the whole place.
//
// It's a SKETCH, not a survey: the same layout rules for every place (range on
// the left with its tee line, short game on the right; simulator rooms as rows
// of bays), built from the areas each place has. It says "not to scale" so no
// one mistakes it for a real map.
//
// Each area is a real button (Tab, then Enter or Space) that opens a pop-up
// with its details, so the map works without a mouse too.

const W = 600;
const H = 320;

type Look = { fill: string; stroke: string; dash?: string; text: string; word: string | null; faded?: boolean; starred?: boolean };

const tones = {
  open: { fill: "fill-open-tint", stroke: "stroke-open", text: "fill-open" },
  limited: { fill: "fill-limited-tint", stroke: "stroke-limited", text: "fill-limited" },
  closed: { fill: "fill-closed-tint", stroke: "stroke-closed", text: "fill-closed" },
};
const dashFor = (basis: AreaStatus["basis"]) => (basis === "likely" ? "10 6" : basis === "season" || basis === "weather" ? "2 5" : undefined);
// Says where a status comes from when it isn't a fresh report, so a published
// season ("closed · season") can't be mistaken for what a golfer saw.
const wordFor = (state: AreaStatus["state"], basis: AreaStatus["basis"]) =>
  basis === "likely"
    ? `probably ${stateWord[state].toLowerCase()}`
    : basis === "season"
      ? `${stateWord[state].toLowerCase()} · season`
      : basis === "weather"
        ? `${stateWord[state].toLowerCase()} · storm`
        : basis === "confirmed"
          ? `${stateWord[state].toLowerCase()} · admin`
          : stateWord[state].toLowerCase();

function look(s: AreaStatus): Look {
  if (s.basis === "hours") {
    // The place is closed by its hours, but something is known about this
    // area: show it in its color, faded, as "last: limited". Planning
    // tomorrow's session at night is exactly when this matters.
    if (s.lastKnown) {
      const { state, basis } = s.lastKnown;
      const whole = basis === "confirmed" && s.lastKnown.wholePlace;
      return { ...tones[state], dash: dashFor(basis), word: `last: ${whole ? stateWord[state].toLowerCase() : wordFor(state, basis)}`, faded: true, starred: basis === "confirmed" && !whole };
    }
    return { fill: "fill-surface", stroke: "stroke-edge/40", text: "fill-muted", word: null };
  }
  // An admin's status for the whole place: the stars around the map say so,
  // so each area stays plain (if every area had stars, none would stand out).
  if (s.basis === "confirmed" && s.wholePlace) return { ...tones[s.state], word: stateWord[s.state].toLowerCase() };
  return { ...tones[s.state], dash: dashFor(s.basis), word: wordFor(s.state, s.basis), starred: s.basis === "confirmed" };
}

// What a screen reader hears for an area.
const spoken = (s: AreaStatus) => {
  if (s.basis === "confirmed" && s.wholePlace) return `${look(s).word}, set for the whole place by a Range Report admin`;
  if (s.basis !== "hours") return look(s).word!;
  const last = s.lastKnown ? `, last known ${wordFor(s.lastKnown.state, s.lastKnown.basis)}` : "";
  return (s.state === "closed" ? "closed by its hours" : "no current report") + last;
};

// One clickable area: its shape(s), then its label on top.
function Area({
  status,
  onSelect,
  children,
  label,
}: {
  status: AreaStatus;
  onSelect: (id: string) => void;
  children: (l: Look) => ReactNode;
  label: { x: number; y: number; small?: boolean; inline?: boolean };
}) {
  const l = look(status);
  const size = label.small ? 12 : 15;
  const [shapes, stars] = useStarsAlong(!!l.starred);
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${status.area.label}: ${spoken(status)}. Show details`}
      className="area cursor-pointer outline-none transition-opacity hover:opacity-80"
      onClick={() => onSelect(status.area.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(status.area.id);
        }
      }}
    >
      {/* Last known while the place is closed: same color, faded. */}
      <g opacity={l.faded ? 0.55 : 1}>
        <g ref={shapes}>{children(l)}</g>
        {stars.length > 0 && (
          <g className="pointer-events-none fill-brass stroke-surface" strokeWidth={1}>
            {stars.map(([x, y], i) => <path key={i} d={starPath(x, y, 5)} />)}
          </g>
        )}
      </g>
      <text x={label.x} y={label.y} textAnchor="middle" className="pointer-events-none select-none" style={{ fontSize: size }} aria-hidden>
        <tspan className="fill-ink font-semibold">{status.area.label}</tspan>
        {l.word &&
          (label.inline ? (
            <tspan className={cx(l.text, "font-semibold")}> · {l.word}</tspan>
          ) : (
            <tspan x={label.x} dy={size + 3} className={cx(l.text, "font-semibold")} style={{ fontSize: size - 2 }}>
              {l.word}
            </tspan>
          ))}
      </text>
    </g>
  );
}

// "area-shape" is the outline the keyboard focus ring goes on (globals.css).
const shape = (l: Look) => ({ className: cx("area-shape", l.fill, l.stroke), strokeWidth: 2.5, strokeDasharray: l.dash });

// Small stars spaced along an area's outline(s), for an admin's status, so it
// can't pass for a golfer's report. The outlines are rects, ellipses and
// paths, so they're measured in the browser rather than worked out here.
const STAR_STEP = 24;
function useStarsAlong(enabled: boolean) {
  const [points, setPoints] = useState<[number, number][]>([]);
  const ref = useCallback(
    (g: SVGGElement | null) => {
      if (!g) return;
      const out: [number, number][] = [];
      if (enabled) {
        g.querySelectorAll<SVGGeometryElement>(".area-shape").forEach((el) => {
          const len = el.getTotalLength();
          const n = Math.max(6, Math.round(len / STAR_STEP));
          for (let i = 0; i < n; i++) {
            const p = el.getPointAtLength((len * i) / n);
            out.push([Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]);
          }
        });
      }
      setPoints((prev) => (prev.length === out.length && prev.every((p, i) => p[0] === out[i][0] && p[1] === out[i][1]) ? prev : out));
    },
    [enabled],
  );
  return [ref, points] as const;
}

// Flags and target greens: decoration only, never clickable.
function Flag({ x, y }: { x: number; y: number }) {
  return (
    <g className="pointer-events-none stroke-ink/50" strokeWidth={1.5}>
      <line x1={x} y1={y} x2={x} y2={y - 22} />
      <path d={`M${x} ${y - 22} L${x + 11} ${y - 18} L${x} ${y - 14} Z`} className="fill-brass stroke-none" />
    </g>
  );
}

function WalkIn({ byKind, onSelect }: { byKind: Partial<Record<AreaKind, AreaStatus>>; onSelect: (id: string) => void }) {
  const { range, bays, chipping, bunker, putting } = byKind;
  const fieldBottom = bays ? 232 : 312;
  // Short game column on the right: chipping (with its bunker) above putting.
  const col = { x: 404, w: 188 };
  const shortGame = [chipping ?? bunker, putting].filter(Boolean).length;
  const hasShort = shortGame > 0;
  const rangeRight = hasShort ? 388 : W - 8;
  const rangeMid = (8 + rangeRight) / 2;
  // Where golfers hit from: the tee line, or the stalls' edge when there are stalls.
  const tee = bays ? fieldBottom - 10 : fieldBottom - 30;
  const chipBox = chipping || bunker ? { y: 8, h: putting ? 182 : 304 } : null;
  // A putting green on its own stays green-shaped (not a tall egg): centered, capped height.
  const puttBox = putting ? (chipBox ? { y: 204, h: 108 } : { y: 80, h: 160 }) : null;

  return (
    <>
      {range && (
        <Area status={range} onSelect={onSelect} label={{ x: rangeMid, y: fieldBottom / 2 - 6 }}>
          {(l) => (
            <>
              <rect x={8} y={8} width={rangeRight - 8} height={fieldBottom - 8} rx={14} {...shape(l)} />
              {/* Target greens and yardage arcs, faint, from the tee line. */}
              <g className="pointer-events-none fill-none stroke-ink/15" strokeWidth={1.5}>
                <path d={`M${rangeMid - 120} ${tee} A 120 120 0 0 1 ${rangeMid + 120} ${tee}`} strokeDasharray="6 6" />
                <path d={`M${rangeMid - 170} ${tee - 40} A 200 200 0 0 1 ${rangeMid + 170} ${tee - 40}`} strokeDasharray="6 6" />
                <circle cx={rangeMid - 110} cy={70} r={16} />
                <circle cx={rangeMid + 60} cy={46} r={20} />
                <circle cx={rangeMid + 120} cy={fieldBottom - 90} r={12} />
              </g>
              {!bays && (
                <line x1={20} y1={tee} x2={rangeRight - 12} y2={tee} className="pointer-events-none stroke-ink/30" strokeWidth={2} strokeDasharray="3 5" />
              )}
            </>
          )}
        </Area>
      )}

      {bays && (
        <Area status={bays} onSelect={onSelect} label={{ x: rangeMid, y: 258, small: true, inline: true }}>
          {(l) => (
            <>
              <rect x={8} y={242} width={rangeRight - 8} height={70} rx={10} {...shape(l)} />
              {Array.from({ length: 8 }, (_, i) => {
                const w = (rangeRight - 8 - 24) / 8;
                return <rect key={i} x={20 + i * w} y={268} width={w - 8} height={34} rx={4} className="pointer-events-none fill-none stroke-ink/25" strokeWidth={1.5} />;
              })}
            </>
          )}
        </Area>
      )}

      {chipBox && chipping && (
        <Area status={chipping} onSelect={onSelect} label={{ x: col.x + col.w / 2, y: chipBox.y + 30, small: true }}>
          {(l) => (
            <>
              <rect x={col.x} y={chipBox.y} width={col.w} height={chipBox.h} rx={26} {...shape(l)} />
              <ellipse cx={col.x + col.w - 46} cy={chipBox.y + chipBox.h / 2 + 4} rx={28} ry={16} className="pointer-events-none fill-none stroke-ink/25" strokeWidth={1.5} />
              <Flag x={col.x + col.w - 46} y={chipBox.y + chipBox.h / 2 + 4} />
            </>
          )}
        </Area>
      )}

      {chipBox && bunker && (
        <Area
          status={bunker}
          onSelect={onSelect}
          label={{ x: col.x + 70, y: chipBox.y + chipBox.h - (chipping ? 42 : chipBox.h / 2) - 2, small: true }}
        >
          {(l) => (
            <ellipse
              cx={col.x + 70}
              cy={chipBox.y + chipBox.h - (chipping ? 42 : chipBox.h / 2)}
              rx={chipping ? 60 : 80}
              ry={chipping ? 26 : 50}
              {...shape(l)}
            />
          )}
        </Area>
      )}

      {puttBox && putting && (
        <Area status={putting} onSelect={onSelect} label={{ x: col.x + col.w / 2, y: puttBox.y + puttBox.h / 2 - 4, small: true }}>
          {(l) => (
            <>
              <ellipse cx={col.x + col.w / 2} cy={puttBox.y + puttBox.h / 2} rx={col.w / 2 - 2} ry={puttBox.h / 2 - 2} {...shape(l)} />
              <circle cx={col.x + 40} cy={puttBox.y + puttBox.h / 2 + 22} r={3} className="pointer-events-none fill-ink/40" />
              <circle cx={col.x + col.w - 40} cy={puttBox.y + puttBox.h / 2 + 18} r={3} className="pointer-events-none fill-ink/40" />
            </>
          )}
        </Area>
      )}
    </>
  );
}

function Sim({ byKind, onSelect }: { byKind: Partial<Record<AreaKind, AreaStatus>>; onSelect: (id: string) => void }) {
  const { bays, putting } = byKind;
  const rows = putting ? 1 : 2;
  const perRow = putting ? 6 : 5;
  const baysBottom = putting ? 196 : 312;

  return (
    <>
      {/* The room. */}
      <rect x={4} y={4} width={W - 8} height={H - 8} rx={12} className="pointer-events-none fill-cream/50 stroke-rule" strokeWidth={2} />
      {bays && (
        <Area status={bays} onSelect={onSelect} label={{ x: W / 2, y: 34, small: true, inline: true }}>
          {(l) => (
            <>
              <rect x={16} y={14} width={W - 32} height={baysBottom - 22} rx={10} {...shape(l)} />
              {Array.from({ length: rows * perRow }, (_, i) => {
                const r = Math.floor(i / perRow);
                const c = i % perRow;
                const w = (W - 56) / perRow;
                const top = 50;
                const h = (baysBottom - 22 - top - 8 - (rows - 1) * 12) / rows;
                const y = top + r * (h + 12);
                return (
                  <g key={i} className="pointer-events-none">
                    <rect x={28 + c * w} y={y} width={w - 12} height={h} rx={4} className="fill-none stroke-ink/25" strokeWidth={1.5} />
                    {/* The screen at the far end of each bay. */}
                    <line x1={34 + c * w} y1={y + 7} x2={22 + (c + 1) * w - 18} y2={y + 7} className="stroke-ink/40" strokeWidth={3} strokeLinecap="round" />
                  </g>
                );
              })}
            </>
          )}
        </Area>
      )}
      {putting && (
        <Area status={putting} onSelect={onSelect} label={{ x: W / 2, y: 256, small: true }}>
          {(l) => (
            <>
              <rect x={150} y={208} width={300} height={94} rx={47} {...shape(l)} />
              <circle cx={190} cy={262} r={3} className="pointer-events-none fill-ink/40" />
              <circle cx={410} cy={258} r={3} className="pointer-events-none fill-ink/40" />
            </>
          )}
        </Area>
      )}
    </>
  );
}

// An indoor dome with no outdoor range (Mistwood): the roof, a row of hitting
// bays along the bottom facing into the dome, and the short game area and
// putting green under the roof.
function Dome({ byKind, onSelect }: { byKind: Partial<Record<AreaKind, AreaStatus>>; onSelect: (id: string) => void }) {
  const { bays, chipping, putting } = byKind;
  const both = chipping && putting;
  return (
    <>
      {/* The dome's roof line. */}
      <path d={`M8 ${H - 8} L8 120 Q${W / 2} -30 ${W - 8} 120 L${W - 8} ${H - 8} Z`} className="pointer-events-none fill-cream/50 stroke-rule" strokeWidth={2} />
      <path d={`M60 ${H - 90} Q${W / 2} 20 ${W - 60} ${H - 90}`} className="pointer-events-none fill-none stroke-ink/10" strokeWidth={1.5} strokeDasharray="6 6" />
      {chipping && (
        <Area status={chipping} onSelect={onSelect} label={{ x: both ? 175 : W / 2, y: 152, small: true }}>
          {(l) => (
            <>
              <rect x={both ? 60 : 150} y={112} width={both ? 230 : 300} height={110} rx={26} {...shape(l)} />
              <ellipse cx={both ? 230 : 390} cy={190} rx={24} ry={13} className="pointer-events-none fill-none stroke-ink/25" strokeWidth={1.5} />
              <Flag x={both ? 230 : 390} y={190} />
            </>
          )}
        </Area>
      )}
      {putting && (
        <Area status={putting} onSelect={onSelect} label={{ x: both ? 425 : W / 2, y: 162, small: true }}>
          {(l) => (
            <>
              <ellipse cx={both ? 425 : W / 2} cy={167} rx={both ? 115 : 150} ry={52} {...shape(l)} />
              <circle cx={both ? 360 : 230} cy={185} r={3} className="pointer-events-none fill-ink/40" />
              <circle cx={both ? 490 : 370} cy={180} r={3} className="pointer-events-none fill-ink/40" />
            </>
          )}
        </Area>
      )}
      {bays && (
        <Area status={bays} onSelect={onSelect} label={{ x: W / 2, y: 252, small: true, inline: true }}>
          {(l) => (
            <>
              <rect x={24} y={236} width={W - 48} height={72} rx={10} {...shape(l)} />
              {Array.from({ length: 10 }, (_, i) => {
                const w = (W - 72) / 10;
                return <rect key={i} x={36 + i * w} y={264} width={w - 8} height={34} rx={4} className="pointer-events-none fill-none stroke-ink/25" strokeWidth={1.5} />;
              })}
            </>
          )}
        </Area>
      )}
    </>
  );
}

// A quiet frame of small brass stars just outside the sketch: an admin set the
// whole place. Drawn in a margin the areas never reach.
const FRAME = 16;
function StarFrame() {
  const step = 26;
  const x0 = -FRAME / 2, y0 = -FRAME / 2, x1 = W + FRAME / 2, y1 = H + FRAME / 2;
  const along = (a: number, b: number) => {
    const n = Math.max(1, Math.round((b - a) / step));
    return Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  };
  const pts: [number, number][] = [
    ...along(x0, x1).map((x) => [x, y0] as [number, number]),
    ...along(x0, x1).map((x) => [x, y1] as [number, number]),
    ...along(y0, y1).slice(1, -1).map((y) => [x0, y] as [number, number]),
    ...along(y0, y1).slice(1, -1).map((y) => [x1, y] as [number, number]),
  ];
  return (
    <g className="pointer-events-none fill-brass" opacity={0.85} aria-hidden>
      {pts.map(([x, y]) => <path key={`${x},${y}`} d={starPath(x, y, 4.2)} />)}
    </g>
  );
}

export function FacilityMap({
  place,
  status,
  onSelect,
  wholeRule,
}: {
  place: Place;
  status: PlaceStatus;
  onSelect: (areaId: string) => void;
  wholeRule?: ConfirmedRule; // an admin's status for the whole place, in effect today
}) {
  // One area per kind is all any place has today; the first one wins if not.
  const byKind: Partial<Record<AreaKind, AreaStatus>> = {};
  for (const a of status.areas) byKind[a.area.kind] ??= a;

  const summary = status.areas
    .map((a) => `${a.area.label}: ${spoken(a)}`)
    .join("; ");

  return (
    <figure className="flex flex-col gap-2">
      {/* A group of buttons, one per area: Tab moves between them, Enter opens one. */}
      <svg
        viewBox={wholeRule ? `${-FRAME} ${-FRAME} ${W + 2 * FRAME} ${H + 2 * FRAME}` : `0 0 ${W} ${H}`}
        className="h-auto w-full rounded-lg bg-cream/40"
        role="group"
        aria-label={`Sketch of ${place.name}. ${summary}.`}
      >
        {wholeRule && <StarFrame />}
        {place.kind === "sim" ? (
          <Sim byKind={byKind} onSelect={onSelect} />
        ) : !byKind.range && byKind.bays ? (
          // A walk-in place with bays but no outdoor range is an indoor dome.
          <Dome byKind={byKind} onSelect={onSelect} />
        ) : (
          <WalkIn byKind={byKind} onSelect={onSelect} />
        )}
      </svg>
      <figcaption className="flex flex-col gap-1 text-label font-normal text-muted">
        {wholeRule && (
          <span className="flex items-start gap-1.5 text-ink">
            <AdminStar className="mt-0.5 size-3.5" />
            <span>
              A Range Report admin set the whole place to {wholeRule.condition}.
              {status.areas.some((a) => a.basis === "report" || a.basis === "likely") && " Areas golfers reported since show their report."}
            </span>
          </span>
        )}
        <span>Sketch, not to scale.</span>
      </figcaption>
    </figure>
  );
}
