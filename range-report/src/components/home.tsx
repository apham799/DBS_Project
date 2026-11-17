"use client";

import { Show } from "@clerk/nextjs";
import { useMemo } from "react";
import { PlaceCard } from "@/components/place-card";
import { Legend } from "@/components/status";
import { openWelcome } from "@/components/welcome";
import { Alert, Button, Skeleton, TextLink } from "@/components/ui";
import { places } from "@/data/places";
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

  const mine = places.filter((p) => follows.following.has(p.id));
  const others = places.filter((p) => !follows.following.has(p.id));

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
      <section className="flex flex-col gap-3">
        <h1 className="text-display">Before you drive</h1>
        <p className="max-w-2xl text-body text-muted">
          What&apos;s actually open, usable and crowded at Chicago practice spots, from golfers who were just there. Published hours say a place is open. Reports say whether the part you need is.
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <LiveDot live={live} />
          <Legend />
        </div>
      </section>

      {error && (
        <Alert tone="error" title="Couldn't load reports" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>
          Statuses below are from published hours and seasons only.
        </Alert>
      )}
      {follows.error && <Alert tone="error" title={follows.error} onDismiss={follows.clearError} />}
      {weather.status === "error" && <Alert tone="warning" title="Weather is unavailable right now">Statuses still show, without the thunderstorm check.</Alert>}

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
                  <TextLink href="/sign-up">Sign up</TextLink> to follow your places and post what you find.{" "}
                  <button
                    type="button"
                    onClick={openWelcome}
                    className="rounded-sm font-semibold text-green underline decoration-green/40 decoration-2 underline-offset-[3px] hover:decoration-green"
                  >
                    How it works
                  </button>
                </p>
              </Show>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{others.map(card)}</ul>
          </section>
        </>
      )}
    </div>
  );
}
