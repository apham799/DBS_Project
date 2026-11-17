"use client";

import { Show } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { LiveDot } from "@/components/home";
import { FollowButton } from "@/components/place-card";
import { AreaTile, crowdWord, Legend } from "@/components/status";
import { Alert, Badge, Button, ButtonLink, Card, Skeleton, TextLink, Toast } from "@/components/ui";
import { placeById } from "@/data/places";
import { ageLabel, placeStatus } from "@/lib/status";
import type { Place, Report } from "@/lib/types";
import { useFollows } from "@/lib/use-follows";
import { useReports } from "@/lib/use-reports";
import { useNow, useWeather } from "@/lib/use-weather";

export const POSTED_KEY = "range-report:posted";

const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" });
const conditionWord = { good: "good", limited: "limited", closed: "closed" } as const;

function summarize(place: Place, r: Report): string {
  if (!r.placeOpen) return "Closed when they got there";
  const parts = place.areas.filter((a) => r.areas[a.id]).map((a) => `${a.label}: ${conditionWord[r.areas[a.id]]}`);
  if (r.crowd) parts.push(crowdWord[r.crowd]);
  return parts.length ? parts.join(" · ") : "Open";
}

export function PlaceView({ placeId }: { placeId: string }) {
  const place = placeById(placeId)!;
  const { reports, loaded, error, live, justAdded, retry } = useReports();
  const weather = useWeather();
  const now = useNow();
  const follows = useFollows();
  const [toast, setToast] = useState<string | null>(null);

  // Coming back from the report form: say it worked. sessionStorage only exists
  // in the browser, so it's read after mount (in a callback, not the effect body).
  useEffect(() => {
    const t = setTimeout(() => {
      if (sessionStorage.getItem(POSTED_KEY) !== placeId) return;
      sessionStorage.removeItem(POSTED_KEY);
      setToast("Report posted. Thanks for telling everyone.");
    }, 0);
    return () => clearTimeout(t);
  }, [placeId]);

  const w = weather.status === "ok" ? weather.byPlace[place.id] : undefined;
  // Until the browser clock starts, status is computed at a fixed time and not
  // shown (the tiles show skeletons while `ready` is false).
  const status = useMemo(
    () => placeStatus(place, reports, now ?? new Date(0), weather.status === "ok" ? { stormNow: !!w?.stormNow } : null),
    [place, reports, now, weather.status, w],
  );
  const ready = loaded && now !== null;
  const recent = reports.filter((r) => r.placeId === place.id).slice(0, 10);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;

  return (
    <div className="flex flex-col gap-8">
      <TextLink href="/" className="w-fit">← All places</TextLink>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-display">{place.name}</h1>
            <p className="text-body text-muted">
              {place.neighborhood} · {place.kind === "sim" ? "Simulator bays" : "Walk-in range"} · {place.address}
            </p>
          </div>
          {follows.signedIn && (
            <FollowButton following={follows.following.has(place.id)} name={place.name} onToggle={() => follows.toggle(place.id, place.name)} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={status.hours.open ? "green" : "neutral"}>{status.hours.label}</Badge>
          {status.crowd ? (
            <Badge tone="brass">{crowdWord[status.crowd.level]} · {status.crowd.age}</Badge>
          ) : (
            status.hours.open && <span className="text-label font-normal text-muted">No crowd report in the last 2 hours</span>
          )}
          {w && (
            <span className="text-label font-normal text-muted">
              {w.tempF}°F (feels {w.feelsLikeF}°) · {w.label} · wind {w.windMph} mph
            </span>
          )}
          {weather.status === "error" && <span className="text-label font-normal text-muted">Weather unavailable</span>}
        </div>

        <div className="flex flex-wrap gap-3">
          <Show when="signed-in">
            <ButtonLink href={`/places/${place.id}/report`} size="lg">Post a report</ButtonLink>
          </Show>
          <Show when="signed-out">
            <ButtonLink href={`/sign-in?redirect_url=${encodeURIComponent(`/places/${place.id}/report`)}`} size="lg">Sign in to post a report</ButtonLink>
          </Show>
          <ButtonLink href={directions} variant="secondary" size="lg" target="_blank" rel="noopener noreferrer">Directions</ButtonLink>
        </div>
      </section>

      {error && (
        <Alert tone="error" title="Couldn't load reports" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>
          The areas below are from published hours and seasons only.
        </Alert>
      )}
      {follows.error && <Alert tone="error" title={follows.error} onDismiss={follows.clearError} />}

      <section className="flex flex-col gap-4" aria-labelledby="areas">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="areas" className="text-heading">Right now</h2>
          <LiveDot live={live} />
        </div>
        {ready ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {status.areas.map((a) => (
              <AreaTile key={a.area.id} status={a} highlight={justAdded.has(place.id)} />
            ))}
          </ul>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status">
            <span className="sr-only">Loading reports…</span>
            {place.areas.map((a) => <Skeleton key={a.id} className="h-28" />)}
          </div>
        )}
        <Legend />
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="flex flex-col gap-3 lg:col-span-7" aria-labelledby="recent">
          <h2 id="recent" className="text-heading">Recent reports</h2>
          {loaded && recent.length === 0 && (
            <p className="text-body text-muted">No reports in the last 30 days. If you&apos;re here today, yours will be the first.</p>
          )}
          <ol className="flex flex-col divide-y divide-rule rounded-lg border border-rule">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 px-4 py-3">
                <p className="text-label text-muted">
                  {timeFormat.format(new Date(r.createdAt))} · {now && ageLabel(now.getTime() - new Date(r.createdAt).getTime())}
                </p>
                <p className="text-body">{summarize(place, r)}</p>
              </li>
            ))}
          </ol>
        </section>

        <Card tone="cream" as="section" className="flex flex-col gap-2 lg:col-span-5" labelledBy="published">
          <h2 id="published" className="text-heading">Published info</h2>
          <p className="text-body">{place.hoursNote}</p>
          {place.seasons.length > 0 && (
            <ul className="list-disc pl-5 text-body">
              {place.seasons.map((s) => <li key={s.from + s.note}>{s.note}</li>)}
            </ul>
          )}
          <p className="text-label font-normal text-muted">Checked Nov 16, 2026. A golfer&apos;s report always beats these.</p>
          <a href={place.website} target="_blank" rel="noopener noreferrer" className="w-fit rounded-sm font-semibold text-green underline decoration-green/40 decoration-2 underline-offset-[3px] hover:decoration-green">
            Their website
          </a>
        </Card>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
