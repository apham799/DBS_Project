import Link from "next/link";
import type { ReactNode } from "react";
import { ScrollLink } from "@/components/scroll-link";
import { WeatherScene } from "@/components/weather-scene";
import { sceneCaption, sceneFor } from "@/lib/weather-scene";
import type { PlaceWeather } from "@/lib/weather-server";

// The landing section at the top of Home (from v1 feedback: a calm, larger
// top section with the tagline instead of a pop-up over a busy page). One
// sentence and two ways in; the details live on the How it works page.

// Two different ways down: "Find a place" opens the list if needed and takes
// you to it; "See the places" / "Hide the places" opens or closes the list
// below the banner without moving the page.
export function Hero({
  live,
  placesOpen,
  onTogglePlaces,
  onFind,
  weather,
}: {
  live?: ReactNode;
  placesOpen: boolean;
  onTogglePlaces: () => void;
  onFind: () => void;
  weather?: PlaceWeather; // Chicago right now: the scene and its caption follow it
}) {
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
      <div className="relative lg:col-span-6">
        <div className="lg:absolute lg:inset-0 lg:[mask-image:linear-gradient(to_right,transparent,black_30%)]">
          <WeatherScene scene={sceneFor(weather)} />
        </div>
        {/* The weather the scene shows, in words: a small pill in the picture's corner. */}
        {weather && (
          <p className="absolute right-3 top-3 z-10 rounded-full border border-ink/10 bg-surface/85 px-3 py-1 text-label font-semibold text-ink shadow-card backdrop-blur-sm">
            <span className="hidden font-normal text-muted sm:inline">Chicago now · </span>
            {sceneCaption(weather)}
          </p>
        )}
      </div>
    </section>
  );
}
