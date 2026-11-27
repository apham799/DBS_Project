"use client";

import { Show } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { Hero } from "@/components/hero";
import { PlaceCard } from "@/components/place-card";
import { PlaceFilters } from "@/components/place-filters";
import { Alert, Button, cx, Skeleton, TextLink } from "@/components/ui";
import { places } from "@/data/places";
import { FEATURES, matches, NO_FILTERS, type Feature, type Filters } from "@/lib/filters";
import { effectiveNow, placeStatus } from "@/lib/status";
import { useFollows } from "@/lib/use-follows";
import { useReports, type LiveStatus } from "@/lib/use-reports";
import { useNow, useWeather } from "@/lib/use-weather";

// Whether new reports are arriving on their own. `compact` is the small pill
// that sits right after a heading ("Right now · Live"); the full sentence is
// for the home page intro, where it explains what "live" means.
export function LiveDot({ live, compact }: { live: LiveStatus; compact?: boolean }) {
  const dot = <span className={live === "live" ? "size-2 rounded-full bg-open motion-safe:animate-pulse" : "size-2 rounded-full bg-limited"} aria-hidden />;
  if (compact) {
    return (
      <span
        role="status"
        title={live === "live" ? "New reports appear on their own" : "Reports may be out of date"}
        className="inline-flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-0.5 text-label font-normal text-muted"
      >
        {dot}
        {live === "live" ? "Live" : live === "connecting" ? "Connecting…" : "Reconnecting…"}
        {live === "live" && <span className="sr-only">: new reports appear on their own</span>}
      </span>
    );
  }
  return (
    <p className="flex items-center gap-2 text-label font-normal text-muted" role="status">
      {dot}
      {live === "live" ? "Live: new reports appear on their own" : live === "connecting" ? "Connecting…" : "Reconnecting… reports may be out of date"}
    </p>
  );
}

// Filters last for the browser tab (sessionStorage), so they survive opening a
// place and coming back. Read after mount, so the server render and the first
// browser render agree.
const FILTERS_KEY = "range-report:filters";
const KNOWN = new Set(FEATURES.map((f) => f.id));

function useFilters(): [Filters, (f: Filters) => void] {
  const [filters, setState] = useState<Filters>(NO_FILTERS);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(FILTERS_KEY) ?? "null") as Partial<Filters> | null;
        if (!saved) return;
        setState({
          features: (saved.features ?? []).filter((f): f is Feature => KNOWN.has(f as Feature)),
          setting: saved.setting === "indoor" || saved.setting === "outdoor" ? saved.setting : null,
          openNow: saved.openNow === true,
        });
      } catch {
        // A bad saved value just means no filters.
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const set = (f: Filters) => {
    setState(f);
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify(f));
  };
  return [filters, set];
}

// Whether the place list under the banner is open. First-time visitors start
// with just the banner; once you open it, it stays open on later visits
// (localStorage). Read after mount, so server and first render agree.
const PLACES_OPEN_KEY = "range-report:places-open";

function usePlacesOpen(): [boolean, (open: boolean) => void] {
  const [open, setState] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (localStorage.getItem(PLACES_OPEN_KEY) === "1") setState(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const set = (next: boolean) => {
    setState(next);
    localStorage.setItem(PLACES_OPEN_KEY, next ? "1" : "0");
  };
  return [open, set];
}

export function Home() {
  const { reports, loaded, error, live, justAdded, retry } = useReports();
  const weather = useWeather();
  const clock = useNow();
  // Never behind the newest report (a slow device clock would hide it).
  const now = useMemo(() => clock && effectiveNow(clock, reports), [clock, reports]);
  const follows = useFollows();

  const statuses = useMemo(
    () =>
      now &&
      Object.fromEntries(
        places.map((p) => [p.id, placeStatus(p, reports, now, weather.status === "ok" ? { stormNow: !!weather.byPlace[p.id]?.stormNow } : null)]),
      ),
    [reports, now, weather],
  );

  const [filters, setFilters] = useFilters();
  const [placesOpen, setPlacesOpen] = usePlacesOpen();
  const [instant, setInstant] = useState(false);
  const visible = places.filter((p) => matches(p, statuses?.[p.id], filters));
  const mine = visible.filter((p) => follows.following.has(p.id));
  const others = visible.filter((p) => !follows.following.has(p.id));

  const card = (p: (typeof places)[number]) => statuses && now && (
    <PlaceCard
      key={p.id}
      place={p}
      status={statuses[p.id]}
      weather={weather.status === "ok" ? weather.byPlace[p.id] : undefined}
      now={now}
      following={follows.following.has(p.id)}
      onToggleFollow={follows.signedIn ? () => follows.toggle(p.id, p.name) : undefined}
      highlight={justAdded.has(p.id)}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <Hero
        live={<LiveDot live={live} />}
        placesOpen={placesOpen}
        onTogglePlaces={() => {
          setInstant(false);
          setPlacesOpen(!placesOpen);
        }}
        // Opening for "Find a place" is instant, so the page is long enough to
        // scroll down to the list straight away.
        onFind={() => {
          setInstant(true);
          setPlacesOpen(true);
        }}
      />

      {error && (
        <Alert tone="error" title="Couldn't load reports" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>
          Statuses below are from published hours and seasons only.
        </Alert>
      )}
      {follows.error && <Alert tone="error" title={follows.error} onDismiss={follows.clearError} />}
      {weather.status === "error" && <Alert tone="warning" title="Weather is unavailable right now">Statuses still show, without the thunderstorm check.</Alert>}

      {/* "Find a place" in the hero scrolls here (below the sticky header).
          The list opens and closes with "See / Hide the places": the grid row
          animates between 0 and its full height, and a closed list is inert
          (not focusable, not read out). */}
      <div id="places" tabIndex={-1} className="scroll-mt-24 outline-none">
      <div
        className={cx(
          "grid",
          !instant && "transition-[grid-template-rows,opacity] duration-500 ease-out motion-reduce:transition-none",
          placesOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
      <div className="min-h-0 overflow-clip [overflow-clip-margin:24px]" inert={!placesOpen}>
      <div id="places-list" className="flex flex-col gap-8">
      <PlaceFilters filters={filters} onChange={setFilters} shown={visible.length} total={places.length} />
      {!loaded || !statuses ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Loading places">
          {places.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Skeleton className="h-44 w-full" />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {mine.length > 0 && (
            <section className="flex flex-col gap-4" aria-labelledby="mine">
              <h2 id="mine" className="text-heading">Your places</h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{mine.map(card)}</ul>
            </section>
          )}
          <section className="flex flex-col gap-4" aria-labelledby="all">
            <div className="flex flex-col gap-1">
              <h2 id="all" className="text-heading">{mine.length ? "Other places" : "Places"}</h2>
              <Show when="signed-in">
                {mine.length === 0 && <p className="text-body text-muted">Follow the places you practice, and they&apos;ll stay at the top.</p>}
              </Show>
              <Show when="signed-out">
                <p className="text-body text-muted">
                  <TextLink href="/sign-up">Sign up</TextLink> to follow your places and post what you find.
                </p>
              </Show>
            </div>
            {visible.length === 0 ? (
              <div className="flex flex-col items-start gap-2 rounded-lg border-2 border-dashed border-edge/40 bg-cream/60 p-5">
                <p className="text-body">No places match all of those.</p>
                <Button size="sm" variant="secondary" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>
              </div>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{others.map(card)}</ul>
            )}
          </section>
        </>
      )}
      </div>
      </div>
      </div>
      </div>
    </div>
  );
}
