"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import type { AreaStatus, PlaceStatus } from "@/lib/status";
import type { AreaKind, Place } from "@/lib/types";
import { stateWord } from "@/components/status";

// The facility heat map (Lauren's idea): a sketch of the place with each area
// filled by its status right now, using the same colors and "how sure"
// outlines as the area rows (solid = reported today, dashed = probably,
// dotted = season or weather, plain white = nothing known).
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

type Look = { fill: string; stroke: string; dash?: string; text: string; word: string | null };

function look(s: AreaStatus): Look {
  if (s.basis === "hours") return { fill: "fill-surface", stroke: "stroke-edge/40", text: "fill-muted", word: null };
  const tone = {
    open: { fill: "fill-open-tint", stroke: "stroke-open", text: "fill-open" },
    limited: { fill: "fill-limited-tint", stroke: "stroke-limited", text: "fill-limited" },
    closed: { fill: "fill-closed-tint", stroke: "stroke-closed", text: "fill-closed" },
  }[s.state];
  const dash = s.basis === "likely" ? "10 6" : s.basis === "season" || s.basis === "weather" ? "2 5" : undefined;
  const word = s.basis === "likely" ? `probably ${stateWord[s.state].toLowerCase()}` : stateWord[s.state].toLowerCase();
  return { ...tone, dash, word };
}

// What a screen reader hears for an area.
const spoken = (s: AreaStatus) => look(s).word ?? (s.state === "closed" ? "closed by its hours" : "no current report");

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
      {children(l)}
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

export function FacilityMap({ place, status, onSelect }: { place: Place; status: PlaceStatus; onSelect: (areaId: string) => void }) {
  // One area per kind is all any place has today; the first one wins if not.
  const byKind: Partial<Record<AreaKind, AreaStatus>> = {};
  for (const a of status.areas) byKind[a.area.kind] ??= a;

  const summary = status.areas
    .map((a) => `${a.area.label}: ${spoken(a)}`)
    .join("; ");

  return (
    <figure className="flex flex-col gap-2">
      {/* A group of buttons, one per area: Tab moves between them, Enter opens one. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-lg bg-cream/40" role="group" aria-label={`Sketch of ${place.name}. ${summary}.`}>
        {place.kind === "sim" ? <Sim byKind={byKind} onSelect={onSelect} /> : <WalkIn byKind={byKind} onSelect={onSelect} />}
      </svg>
      <figcaption className="text-label font-normal text-muted">Sketch, not to scale.</figcaption>
    </figure>
  );
}
