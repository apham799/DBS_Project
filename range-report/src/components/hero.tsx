import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollLink } from "@/components/scroll-link";

// The landing section at the top of Home (from v1 feedback: a calm, larger
// top section with the tagline instead of a pop-up over a busy page). One
// sentence and two ways in; the details live on the How it works page.

// Two different ways down: "Find a place" opens the list if needed and takes
// you to it; "See the places" / "Hide the places" opens or closes the list
// below the banner without moving the page.
export function Hero({ live, placesOpen, onTogglePlaces, onFind }: { live?: ReactNode; placesOpen: boolean; onTogglePlaces: () => void; onFind: () => void }) {
  return (
    <section
      aria-labelledby="hero-title"
      // Fills the first screen (minus the header).
      className="relative grid min-h-[calc(100svh-10.5rem)] overflow-hidden rounded-2xl border border-cream-deep bg-cream lg:min-h-[max(26rem,calc(100svh-10.5rem))] lg:grid-cols-12"
    >
      <div className="relative z-10 flex flex-col justify-center gap-5 p-6 sm:p-10 lg:col-span-6 lg:p-14">
        <p className="text-label font-semibold uppercase tracking-[0.14em] text-green">Chicago practice spots</p>
        <h1 id="hero-title" className="font-display text-[2.6rem] font-semibold leading-[1.05] text-ink sm:text-6xl">
          Know what&apos;s open before you drive.
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-muted">
          Live conditions at Chicago practice facilities. Made by golfers, for golfers.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ScrollLink to="places" onActivate={onFind}>Find a place</ScrollLink>
          <Link href="/how-it-works" className="rounded-sm px-2 py-3 text-body font-semibold text-green underline decoration-green/40 decoration-2 underline-offset-[3px] hover:decoration-green">
            How it works
          </Link>
        </div>
        {live}
        <button
          type="button"
          onClick={onTogglePlaces}
          aria-expanded={placesOpen}
          aria-controls="places-list"
          // Plain green text with a small arrow, at the bottom of the text side on
          // wide screens (under the buttons on phones). Not a pill: it's a quiet
          // control next to the main "Find a place" button.
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-1 py-1 text-label font-semibold text-green hover:underline lg:absolute lg:bottom-5 lg:left-14"
        >
          {placesOpen ? "Hide the places" : "See the places"}
          <svg
            viewBox="0 0 16 16"
            className={`size-4 transition-transform duration-300 ${placesOpen ? "rotate-180" : "motion-safe:animate-bounce"}`}
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6 L8 10 L12 6" />
          </svg>
        </button>
      </div>
      {/* On wide screens the scene fades in from the left, so there's no hard seam with the text side. */}
      <div className="relative lg:col-span-6 lg:[mask-image:linear-gradient(to_right,transparent,black_18%)]" aria-hidden>
        <GolfScene />
      </div>
    </section>
  );
}

// A quiet practice-facility scene in the site's colors: sky, a tree line,
// a fairway rolling to a green with a flag, and a few balls on the range.
function GolfScene() {
  return (
    <svg viewBox="0 0 600 420" preserveAspectRatio="xMidYMax slice" className="h-56 w-full sm:h-72 lg:absolute lg:inset-0 lg:h-full">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8f2e4" />
          <stop offset="1" stopColor="#efe5cf" />
        </linearGradient>
        <linearGradient id="fairway" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4f8a63" />
          <stop offset="1" stopColor="#2f6b4f" />
        </linearGradient>
      </defs>
      <rect width="600" height="420" fill="url(#sky)" />
      {/* Sun */}
      <circle cx="470" cy="92" r="38" fill="#b8893b" opacity="0.28" />
      {/* Tree line */}
      <path
        d="M0 228 C 30 196, 60 214, 82 200 C 108 182, 132 206, 158 194 C 186 180, 210 204, 240 190 C 268 176, 296 200, 326 188 C 356 176, 384 198, 414 186 C 446 172, 476 196, 506 184 C 538 172, 570 194, 600 182 L 600 262 L 0 262 Z"
        fill="#1f4d3a"
        opacity="0.85"
      />
      {/* Far fairway */}
      <path d="M0 250 C 140 226, 300 236, 600 214 L 600 420 L 0 420 Z" fill="#6e9f74" />
      {/* Near fairway */}
      <path d="M0 312 C 160 280, 380 300, 600 268 L 600 420 L 0 420 Z" fill="url(#fairway)" />
      {/* Green with flag */}
      <ellipse cx="402" cy="262" rx="86" ry="20" fill="#86b98a" />
      <line x1="418" y1="262" x2="418" y2="186" stroke="#2b2a28" strokeWidth="3" strokeLinecap="round" />
      <path d="M418 188 L 458 200 L 418 212 Z" fill="#b8893b" />
      <ellipse cx="418" cy="263" rx="5" ry="2" fill="#16362a" />
      {/* Bunker */}
      <ellipse cx="300" cy="276" rx="46" ry="10" fill="#efe5cf" />
      {/* Range: tee line and balls */}
      <path d="M0 382 C 200 360, 420 372, 600 350" stroke="#f8f2e4" strokeWidth="3" strokeDasharray="10 10" fill="none" opacity="0.6" />
      {[
        [90, 368], [118, 374], [146, 365], [170, 372], [226, 362], [262, 368],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" fill="#ffffff" />
      ))}
      {/* Yardage flags on the range */}
      <line x1="180" y1="300" x2="180" y2="276" stroke="#f8f2e4" strokeWidth="2" />
      <path d="M180 276 L 194 281 L 180 286 Z" fill="#f8f2e4" />
      <line x1="530" y1="282" x2="530" y2="258" stroke="#f8f2e4" strokeWidth="2" />
      <path d="M530 258 L 544 263 L 530 268 Z" fill="#f8f2e4" />
    </svg>
  );
}
