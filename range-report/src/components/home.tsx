"use client";

import { Show } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SHOW_PLACES_EVENT } from "@/components/header";
import { Hero } from "@/components/hero";
import { PlaceCard } from "@/components/place-card";
import { PlaceFilters } from "@/components/place-filters";
import { Alert, Button, cx, Skeleton, TextLink } from "@/components/ui";
import { places as basePlaces } from "@/data/places";
import { usePlaceConfig } from "@/lib/use-place-config";
import { FEATURES, matches, NO_FILTERS, type Feature, type Filters } from "@/lib/filters";
import { bySource } from "@/lib/report-source";
import { counts } from "@/lib/report-visibility";
import { effectiveNow, placeStatus } from "@/lib/status";
import { setReportSource, useReportSource } from "@/lib/use-report-source";
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
  const set = useCallback((next: boolean) => {
    setState(next);
    localStorage.setItem(PLACES_OPEN_KEY, next ? "1" : "0");
  }, []);
  return [open, set];
}

// Whether "Other places" is open, for someone with saved places (it folds
// away so their own come first). Open unless they closed it (localStorage).
const OTHERS_OPEN_KEY = "range-report:other-places-open";

function useOthersOpen(): [boolean, (open: boolean) => void] {
  const [open, setState] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      if (localStorage.getItem(OTHERS_OPEN_KEY) === "0") setState(false);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const set = useCallback((next: boolean) => {
    setState(next);
    localStorage.setItem(OTHERS_OPEN_KEY, next ? "1" : "0");
  }, []);
  return [open, set];
}

// The list grid. No row gap: each card leaves its own space below it, so the
// cards can share rows (see PlaceCard).
// As many columns as keep each card at least 28rem wide, so most names fit
// on one line beside Follow (only the longest get "…").
const COLUMNS = "grid-cols-[repeat(auto-fill,minmax(min(28rem,100%),1fr))]";
const GRID = `grid ${COLUMNS} gap-x-4`;

export function Home() {
  const { reports: allReports, loaded, error, live, justAdded, retry } = useReports();
  // "Reports from": applied once, here, so every status below agrees with it.
  const source = useReportSource();
  const reports = useMemo(() => bySource(allReports, source).filter(counts), [allReports, source]);
  const weather = useWeather();
  // The places, with what admins have set (confirmed statuses, hours) merged in.
  const { withConfig } = usePlaceConfig();
  const places = useMemo(() => basePlaces.map(withConfig), [withConfig]);
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
    [places, reports, now, weather],
  );

  const [filters, setFilters] = useFilters();
  const [placesOpen, setPlacesOpen] = usePlacesOpen();
  const [othersOpen, setOthersOpen] = useOthersOpen();
  const [instant, setInstant] = useState(false);

  // "Places" in the header (or arriving at /#places): open the list instantly
  // and scroll to it once the page is long enough.
  useEffect(() => {
    const show = () => {
      setInstant(true);
      setPlacesOpen(true);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          document.getElementById("places")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }),
      );
    };
    window.addEventListener(SHOW_PLACES_EVENT, show);
    const t = window.location.hash === "#places" ? setTimeout(show, 0) : undefined;
    return () => {
      window.removeEventListener(SHOW_PLACES_EVENT, show);
      clearTimeout(t);
    };
  }, [setPlacesOpen]);
  const visible = places.filter((p) => matches(p, statuses?.[p.id], filters));
  const mine = visible.filter((p) => follows.following.has(p.id));
  const others = visible.filter((p) => !follows.following.has(p.id));
  const hasSaved = follows.following.size > 0;
  // Signed in with saved places: "Other places" can fold away.
  const foldable = follows.signedIn && hasSaved;
  const othersShown = !foldable || othersOpen;

  const card = (p: (typeof places)[number]) => statuses && now && (
    <PlaceCard
      key={p.id}
      place={p}
      status={statuses[p.id]}
      weather={weather.status === "ok" ? weather.byPlace[p.id] : undefined}
      now={now}
      following={follows.following.has(p.id)}
      onToggleFollow={() => follows.toggle(p.id, p.name)}
      highlight={justAdded.has(p.id)}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <Hero
        live={<LiveDot live={live} />}
        // Diversey is central Chicago: its weather stands in for the city's.
        weather={weather.status === "ok" ? weather.byPlace["diversey"] : undefined}
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
        <ul className={cx("grid gap-4", COLUMNS)} aria-label="Loading places">
          {places.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Skeleton className="h-44 w-full" />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {/* Signed in: your saved places first, or a note that there are none yet. */}
          {follows.signedIn && follows.loaded && (
            <section className="flex flex-col gap-4" aria-labelledby="mine">
              <h2 id="mine" className="text-heading">Your places</h2>
              {mine.length > 0 ? (
                <ul className={GRID}>{mine.map(card)}</ul>
              ) : hasSaved ? (
                <p className="text-body text-muted">None of your saved places match these filters.</p>
              ) : (
                <div className="flex flex-col gap-1 rounded-lg border-2 border-dashed border-edge/40 bg-cream/60 p-5">
                  <p className="text-body font-semibold">No saved places yet</p>
                  <p className="text-body text-muted">Tap Follow on a place below and it&apos;ll stay up here, so you can check it first.</p>
                </div>
              )}
            </section>
          )}
          <section className="flex flex-col gap-4" aria-labelledby="all">
            <div className="flex flex-col gap-1">
              {foldable ? (
                <h2 id="all" className="text-heading">
                  <button
                    type="button"
                    aria-expanded={othersOpen}
                    aria-controls="other-places"
                    onClick={() => setOthersOpen(!othersOpen)}
                    className="inline-flex items-center gap-2 rounded-sm text-left hover:text-green"
                  >
                    Other places
                    <span className="text-body font-normal text-muted">{others.length}</span>
                    <svg viewBox="0 0 16 16" className={cx("size-5 text-muted transition-transform duration-200", othersOpen && "rotate-180")} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6 L8 10 L12 6" />
                    </svg>
                  </button>
                </h2>
              ) : (
                <h2 id="all" className="text-heading">{follows.signedIn ? "All places" : "Places"}</h2>
              )}
              <Show when="signed-out">
                <p className="text-body text-muted">
                  <TextLink href="/sign-up">Sign up</TextLink> to follow your places and post what you find.
                </p>
              </Show>
            </div>
            <div id="other-places" hidden={!othersShown && visible.length > 0} className="flex flex-col gap-4">
              {visible.length === 0 ? (
                <div className="flex flex-col items-start gap-2 rounded-lg border-2 border-dashed border-edge/40 bg-cream/60 p-5">
                  <p className="text-body">No places match all of those.</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setFilters(NO_FILTERS);
                      setReportSource("everyone");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : others.length === 0 ? (
                <p className="text-body text-muted">Every place that matches is one of yours.</p>
              ) : (
                <ul className={GRID}>{others.map(card)}</ul>
              )}
            </div>
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
