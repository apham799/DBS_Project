import { useId } from "react";
import type { Scene } from "@/lib/weather-scene";

// The landing banner's practice-facility scene, drawn for the weather right
// now in Chicago: day or night, clear to stormy, and flags flying when it's
// windy. Decorative (the caption says the same in words). Animations live in
// globals.css and stop for reduced motion, leaving a still picture of the same
// weather. Positions are fixed formulas, not random, so the server and the
// browser draw the same thing.

const W = 600;
const H = 420;

// The top of the tree line, shared by the trees and the night shading below them.
const TREE_TOP = "M0 228 C 30 196, 60 214, 82 200 C 108 182, 132 206, 158 194 C 186 180, 210 204, 240 190 C 268 176, 296 200, 326 188 C 356 176, 384 198, 414 186 C 446 172, 476 196, 506 184 C 538 172, 570 194, 600 182";

const OVERCAST = new Set(["cloudy", "fog", "drizzle", "rain", "snow", "storm"]);
const WET = new Set(["drizzle", "rain", "storm"]);

function Cloud({ x, y, s, fill, className }: { x: number; y: number; s: number; fill: string; className?: string }) {
  return (
    <g className={className}>
      <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
        <ellipse cx="0" cy="0" rx="46" ry="22" />
        <ellipse cx="34" cy="-10" rx="34" ry="24" />
        <ellipse cx="68" cy="2" rx="40" ry="20" />
        <ellipse cx="30" cy="10" rx="56" ry="16" />
      </g>
    </g>
  );
}

// Falling rain or snow: the same field twice, one screen apart, so a loop of
// "move down one screen" looks endless.
function Precip({ kind, windy, night }: { kind: "rain" | "drizzle" | "snow"; windy: boolean; night: boolean }) {
  const n = kind === "drizzle" ? 26 : kind === "snow" ? 34 : 48;
  const drops = Array.from({ length: n }, (_, i) => ({ x: ((i * 137) % (W + 120)) - 60, y: (i * 71) % H }));
  const slant = windy ? -12 : -2;
  const field = (dy: number) =>
    drops.map((d, i) =>
      kind === "snow" ? (
        <circle key={`${dy}-${i}`} cx={d.x} cy={d.y + dy} r={i % 3 === 0 ? 3 : 2} fill="#ffffff" stroke={night ? "none" : "#a9b4bd"} strokeWidth="0.8" opacity="0.9" />
      ) : (
        <line
          key={`${dy}-${i}`}
          x1={d.x}
          y1={d.y + dy}
          x2={d.x + slant}
          y2={d.y + dy + (kind === "drizzle" ? 10 : 20)}
          stroke={night ? "#dfe7ee" : "#7f8f9c"}
          strokeWidth={kind === "drizzle" ? 1.2 : 1.6}
          strokeLinecap="round"
          opacity="0.7"
        />
      ),
    );
  const anim = kind === "snow" ? (windy ? "rr-snow-windy" : "rr-snow") : windy ? "rr-rain-windy" : kind === "drizzle" ? "rr-drizzle" : "rr-rain";
  return (
    <g className={anim}>
      {field(0)}
      {field(-H)}
    </g>
  );
}

export function WeatherScene({ scene }: { scene: Scene }) {
  const { night, condition, windy } = scene;
  // Unique gradient ids, so two scenes on one page never borrow each other's sky.
  const uid = useId().replace(/:/g, "");
  const skyId = `sky-${uid}`;
  const fairwayId = `fairway-${uid}`;
  const overcast = OVERCAST.has(condition);
  const sky = night ? (overcast ? ["#1c232d", "#313a46"] : ["#16223a", "#2c3d58"]) : overcast ? ["#e6e4de", "#cfcfc9"] : ["#f8f2e4", "#efe5cf"];
  const cloudFill = night ? (overcast ? "#3c4552" : "#2f3a4b") : overcast ? "#c5c3bb" : "#ffffff";
  const showSun = !night && (condition === "clear" || condition === "partly");
  const showMoon = night && (condition === "clear" || condition === "partly");
  const clouds = condition === "clear" ? [] : condition === "partly" ? [[60, 92, 0.9], [330, 70, 0.7]] : [[-10, 80, 1.3], [180, 54, 1.1], [360, 86, 1.25], [520, 60, 1]];
  const flutter = windy ? "rr-flutter" : undefined;
  const drift = windy ? "rr-cloud-windy" : "rr-cloud";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" className="h-56 w-full sm:h-72 lg:absolute lg:inset-0 lg:h-full" aria-hidden>
      <defs>
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
        <linearGradient id={fairwayId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f8a63" />
          <stop offset="1" stopColor="#2f6b4f" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${skyId})`} />

      {/* Sun, or moon and stars. */}
      {showSun && <circle cx="470" cy="92" r="38" fill="#b8893b" opacity="0.28" />}
      {night && !overcast &&
        Array.from({ length: 18 }, (_, i) => (
          <circle key={i} className={i % 3 === 0 ? "rr-twinkle" : undefined} cx={(i * 97) % W} cy={18 + ((i * 53) % 150)} r={i % 4 === 0 ? 1.6 : 1} fill="#f8f2e4" opacity="0.8" />
        ))}
      {showMoon && (
        <g>
          <circle cx="468" cy="86" r="26" fill="#f1e7cf" />
          <circle cx="480" cy="78" r="23" fill={sky[0]} />
        </g>
      )}

      {/* Clouds, drifting (faster in wind). */}
      {clouds.map(([x, y, s], i) => (
        <Cloud key={i} x={x} y={y} s={s} fill={cloudFill} className={drift} />
      ))}

      {/* The facility. */}
      <path
        d={`${TREE_TOP} L 600 262 L 0 262 Z`}
        fill="#1f4d3a"
        opacity="0.85"
      />
      <path d="M0 250 C 140 226, 300 236, 600 214 L 600 420 L 0 420 Z" fill="#6e9f74" />
      <path d="M0 312 C 160 280, 380 300, 600 268 L 600 420 L 0 420 Z" fill={`url(#${fairwayId})`} />
      <ellipse cx="402" cy="262" rx="86" ry="20" fill="#86b98a" />
      <line x1="418" y1="262" x2="418" y2="186" stroke="#2b2a28" strokeWidth="3" strokeLinecap="round" />
      <path className={flutter} d="M418 188 L 458 200 L 418 212 Z" fill="#b8893b" />
      <ellipse cx="418" cy="263" rx="5" ry="2" fill="#16362a" />
      <ellipse cx="300" cy="276" rx="46" ry="10" fill={WET.has(condition) ? "#d9cfb6" : "#efe5cf"} />
      <path d="M0 382 C 200 360, 420 372, 600 350" stroke="#f8f2e4" strokeWidth="3" strokeDasharray="10 10" fill="none" opacity="0.6" />
      {[
        [90, 368], [118, 374], [146, 365], [170, 372], [226, 362], [262, 368],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill="#ffffff" />
      ))}
      <line x1="180" y1="300" x2="180" y2="276" stroke="#f8f2e4" strokeWidth="2" />
      <path className={flutter} d="M180 276 L 194 281 L 180 286 Z" fill="#f8f2e4" />
      <line x1="530" y1="282" x2="530" y2="258" stroke="#f8f2e4" strokeWidth="2" />
      <path className={flutter} d="M530 258 L 544 263 L 530 268 Z" fill="#f8f2e4" />

      {/* Light: darker at night, a little greyer under cloud. */}
      {night && <path d={`${TREE_TOP} L ${W} ${H} L 0 ${H} Z`} fill="#0b1622" opacity="0.5" />}
      {!night && overcast && <rect width={W} height={H} fill="#5a6466" opacity="0.12" />}

      {/* Weather on top. */}
      {condition === "fog" &&
        [150, 230, 300].map((y, i) => <rect key={y} className={i % 2 ? "rr-fog" : "rr-fog-slow"} x="-60" y={y} width={W + 120} height="34" rx="17" fill="#f1efe9" opacity="0.5" />)}
      {(condition === "rain" || condition === "storm") && <Precip kind="rain" windy={windy} night={night} />}
      {condition === "drizzle" && <Precip kind="drizzle" windy={windy} night={night} />}
      {condition === "snow" && <Precip kind="snow" windy={windy} night={night} />}
      {condition === "storm" && <rect className="rr-flash" width={W} height={H} fill="#ffffff" opacity="0" />}

      {/* Gusts streaking across. */}
      {windy &&
        [120, 210, 330].map((y, i) => (
          <path
            key={y}
            className={`rr-gust rr-gust-${i + 1}`}
            d={`M0 ${y} C 60 ${y - 12}, 120 ${y + 10}, 190 ${y - 4}`}
            fill="none"
            stroke={night ? "#9fb0c2" : "#ffffff"}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        ))}
    </svg>
  );
}
