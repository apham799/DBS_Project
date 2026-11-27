"use client";

import { Show } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveDot } from "@/components/home";
import { FacilityMap } from "@/components/facility-map";
import { FollowButton } from "@/components/place-card";
import { ReportSourcePicker } from "@/components/place-filters";
import { askToSignIn } from "@/components/sign-in-prompt";
import { AreaDetails, crowdWord, GuestTag, HoursBadge, VoteButtons, MapKey, NoDataIcon, Progress, ReportChips, SettingBadge } from "@/components/status";
import { Alert, Badge, Button, ButtonLink, Card, Skeleton, TextLink, Toast } from "@/components/ui";
import { placeById, placeKindLabel } from "@/data/places";
import { settingOf } from "@/lib/filters";
import { bySource, sourceNote, type ReportSource } from "@/lib/report-source";
import { useReportSource } from "@/lib/use-report-source";
import { useDb } from "@/lib/db";
import { counts, hiddenLabel, hiddenWhy } from "@/lib/report-visibility";
import { useVotes } from "@/lib/use-votes";
import { ageLabel, effectiveNow, placeStatus, type AreaStatus } from "@/lib/status";
import { areaTrends, type AreaTrend, MIN_NOTES, MIN_REPORTS, recentReports, summarizeReports, summaryLines } from "@/lib/summary";
import type { Place, Report } from "@/lib/types";
import { useAiSummary } from "@/lib/use-ai-summary";
import { useFollows } from "@/lib/use-follows";
import { useReports } from "@/lib/use-reports";
import { useNow, useWeather } from "@/lib/use-weather";

export const POSTED_KEY = "range-report:posted";

const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" });

// One area's details, in a pop-up over the map. A native <dialog>: focus moves
// in and back to the map when it closes; Esc, the X or a click outside close it.
function AreaDialog({
  status,
  trend,
  now,
  placeId,
  onClose,
}: {
  status: AreaStatus | null;
  trend?: AreaTrend;
  now: Date;
  placeId: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = status !== null;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="area-dialog-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border border-rule bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
    >
      {status && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 id="area-dialog-title" className="text-heading">{status.area.label}</h2>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="-mr-2 -mt-1 rounded-md p-2 text-muted hover:bg-cream hover:text-ink">
              <svg viewBox="0 0 16 16" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4 L12 12 M12 4 L4 12" />
              </svg>
            </button>
          </div>
          <AreaDetails status={status} trend={trend} now={now} />
          <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
            <span className="text-body text-muted">Been here today?</span>
            <PostButton placeId={placeId} size="sm" />
          </div>
        </div>
      )}
    </dialog>
  );
}

// Where to post from this page: the report form if signed in; signed out, the
// sign-in pop-up first, which also offers posting as a guest.
// There's exactly one on the page, in the summary card (both versions of it).
function PostButton({ placeId, size = "lg", label = "Post a report" }: { placeId: string; size?: "sm" | "lg"; label?: string }) {
  return (
    <>
      <Show when="signed-in">
        <ButtonLink href={`/places/${placeId}/report`} size={size}>{label}</ButtonLink>
      </Show>
      <Show when="signed-out">
        {/* The sign-in pop-up, with "post as a guest" as the way to carry on without an account. */}
        <Button
          size={size}
          onClick={() =>
            askToSignIn({
              title: "Post a report",
              reason: "Sign in to keep this report in your own practice log, too.",
              next: `/places/${placeId}/report`,
              guest: { label: "post as a guest", href: `/places/${placeId}/report` },
            })
          }
        >
          {label}
        </Button>
      </Show>
    </>
  );
}

// "What golfers say": the rule-based summary once there are MIN_REPORTS
// reports, with the AI's written summary of the notes on top once there are
// enough notes. The AI part is labeled as such and sits above the reports it
// came from, so anyone can check it.
//
// Before that, it's a different-looking card on purpose (dashed, no shadow,
// its own icon, no status colors, since those all mean a condition): how
// many more reports are needed, and a button to post one.
function SummaryCard({ place, reports, now, source }: { place: Place; reports: Report[]; now: Date; source: ReportSource }) {
  const recent = useMemo(() => recentReports(place, reports, now), [place, reports, now]);
  const summary = useMemo(() => summarizeReports(place, reports, now), [place, reports, now]);
  const notedKey = recent.filter((r) => r.note).map((r) => r.id).join(",");
  const ai = useAiSummary(place.id, notedKey, summary !== null, source);

  if (!summary) {
    const have = Math.min(recent.length, MIN_REPORTS);
    const more = MIN_REPORTS - have;
    return (
      <section aria-labelledby="summary" className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-edge/50 bg-cream/60 p-5">
        <div className="flex items-center gap-2 text-muted">
          <NoDataIcon />
          <h2 id="summary" className="text-heading text-ink">Not enough reports yet</h2>
        </div>
        <Progress have={have} need={MIN_REPORTS} label={`${have} of ${MIN_REPORTS} reports in the last 30 days`} />
        <p className="text-body text-muted">
          {more === MIN_REPORTS ? "After a couple of reports" : "After one more report"}, this shows which areas are usually open and when it&apos;s packed.
        </p>
        <div>
          <PostButton placeId={place.id} size="sm" label={more === MIN_REPORTS ? "Post the first report" : "Post a report"} />
        </div>
      </section>
    );
  }

  return (
    <Card as="section" className="flex flex-col gap-3" labelledBy="summary">
      <h2 id="summary" className="text-heading">What golfers say</h2>
      {ai.status === "loading" && (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Summarizing notes…</span>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}
      {ai.status === "ok" && (
        <div className="flex flex-col gap-1">
          <p className="text-body">{ai.text}</p>
          <p className="text-label font-normal text-muted">
            Written by AI from {ai.reports} reports and {ai.notes} notes. It can get things wrong; the reports are below.
          </p>
        </div>
      )}
      <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
        {summaryLines(summary).map((l) => <li key={l}>{l}</li>)}
      </ul>
      {ai.status === "few_notes" && (
        <Progress
          have={ai.notes}
          need={MIN_NOTES}
          label={`${ai.notes} of ${MIN_NOTES} notes until a written summary of what golfers said`}
        />
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-3">
        <span className="text-body text-muted">Been here today?</span>
        <PostButton placeId={place.id} size="sm" />
      </div>
    </Card>
  );
}

export function PlaceView({ placeId }: { placeId: string }) {
  const place = placeById(placeId)!;
  const { reports: allReports, loaded, error, live, retry, update } = useReports();
  const { db } = useDb();
  // After a vote, read that report again so its counts update even without Realtime.
  const refetch = useCallback(
    async (id: string) => {
      const { data } = await db.from("reports").select("id, place_id, created_at, place_open, areas, crowd, note, source, hidden_at, hidden_reason, up_votes, down_votes").eq("id", id).single();
      if (data)
        update({
          id: data.id,
          placeId: data.place_id,
          createdAt: data.created_at,
          placeOpen: data.place_open,
          areas: data.areas ?? {},
          crowd: data.crowd,
          note: data.note,
          source: data.source,
          hiddenAt: data.hidden_at,
          hiddenReason: data.hidden_reason,
          upVotes: data.up_votes,
          downVotes: data.down_votes,
        });
    },
    [db, update],
  );
  const votes = useVotes(refetch);
  const [showHidden, setShowHidden] = useState(false);
  // "Reports from": applied once, here, so the map, summary and list agree.
  const source = useReportSource();
  const sourced = useMemo(() => bySource(allReports, source), [allReports, source]);
  // Hidden reports (by an admin, or voted down) don't count toward anything;
  // they're still listed, behind "Show hidden reports".
  const reports = useMemo(() => sourced.filter(counts), [sourced]);
  const weather = useWeather();
  const clock = useNow();
  // Never behind the newest report (a slow device clock would hide it).
  const now = useMemo(() => clock && effectiveNow(clock, reports), [clock, reports]);
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
  // The area whose details pop-up is open, if any.
  const [selected, setSelected] = useState<string | null>(null);
  // How each area has been rated in the last 30 days, for the details pop-up.
  const trends = useMemo(
    () => new Map(now ? areaTrends(place, recentReports(place, reports, now)).map((t) => [t.areaId, t]) : []),
    [place, reports, now],
  );
  const placeReports = sourced.filter((r) => r.placeId === place.id).slice(0, 15);
  const recent = placeReports.filter(counts).slice(0, 10);
  const hiddenOnes = placeReports.filter((r) => !counts(r));
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;

  // One report in the list (a render function, not a component defined in
  // here, so React doesn't rebuild every row on each update).
  const reportItem = (r: Report) => {
    const why = hiddenWhy(r);
    return (
      <li key={r.id} className="flex flex-col gap-2 px-4 py-3">
        <p className="flex flex-wrap items-center gap-2 text-label text-muted">
          {timeFormat.format(new Date(r.createdAt))} · {now && ageLabel(now.getTime() - new Date(r.createdAt).getTime())}
          {r.source === "guest" && <GuestTag />}
        </p>
        {why && <p className="text-label font-semibold text-muted">{hiddenLabel(why)}</p>}
        {/* Same chips as the place cards and My Log. */}
        <ReportChips place={place} report={r} />
        {r.note && <p className="text-body italic text-ink/80">&ldquo;{r.note}&rdquo;</p>}
        <VoteButtons
          up={r.upVotes ?? 0}
          down={r.downVotes ?? 0}
          mine={votes.isMine(r.id)}
          myVote={votes.myVote(r.id)}
          onVote={(v) =>
            votes.signedIn
              ? votes.vote(r.id, v)
              : askToSignIn({ title: "Vote on reports", reason: "Sign in to vote reports up or down. Votes help everyone see which reports to trust." })
          }
        />
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <TextLink href="/" className="w-fit">← All places</TextLink>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-display">{place.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-muted">
              <SettingBadge setting={settingOf(place)} />
              <span>{place.neighborhood} · {placeKindLabel(place)} · {place.address}</span>
            </p>
          </div>
          {/* Shown to guests too: tapping it asks them to sign in (and follows once they have). */}
          <FollowButton following={follows.following.has(place.id)} name={place.name} onToggle={() => follows.toggle(place.id, place.name)} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {ready ? <HoursBadge hours={status.hours} /> : <Skeleton className="h-7 w-40 rounded-full" />}
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
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="areas" className="text-heading">Right now</h2>
          <LiveDot live={live} compact />
        </div>
        {/* Directly above the map, in the eye-line of the colors it changes. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-label font-semibold text-muted">Reports from</span>
            <ReportSourcePicker />
          </div>
          {sourceNote[source] && <p className="text-label font-semibold text-limited">{sourceNote[source]}</p>}
        </div>
        {ready ? (
          // The heat map is the whole section: its key beside it on wide
          // screens, below it on phones. Tapping an area opens its details.
          <div className="grid items-start gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 2xl:col-span-7">
              <FacilityMap place={place} status={status} onSelect={setSelected} />
            </div>
            <div className="lg:col-span-4 2xl:col-span-5">
              <MapKey />
            </div>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-12" role="status">
            <span className="sr-only">Loading reports…</span>
            <Skeleton className="aspect-[15/8] w-full lg:col-span-8 2xl:col-span-7" />
          </div>
        )}
      </section>

      {ready && (
        <AreaDialog
          status={status.areas.find((a) => a.area.id === selected) ?? null}
          trend={selected ? trends.get(selected) : undefined}
          now={now}
          placeId={place.id}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Summary and published info side by side on wide screens, stacked on
          smaller ones. items-start: each card is only as tall as its content
          (stretching the shorter one to match left a lot of empty space). */}
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-7">{ready && <SummaryCard place={place} reports={reports} now={now} source={source} />}</div>

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

      <section className="flex flex-col gap-3" aria-labelledby="recent">
        <h2 id="recent" className="text-heading">Recent reports</h2>
        {loaded && recent.length === 0 && (
          <p className="text-body text-muted">No reports in the last 30 days. If you&apos;re here today, yours will be the first.</p>
        )}
        {votes.error && <Alert tone="error" title={votes.error} onDismiss={votes.clearError} />}
        {recent.length > 0 && (
          <ol className="flex flex-col divide-y divide-rule rounded-lg border border-rule">
            {recent.map(reportItem)}
          </ol>
        )}
        {/* Like hidden comments: out of the way, never gone. */}
        {hiddenOnes.length > 0 && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              aria-expanded={showHidden}
              onClick={() => setShowHidden(!showHidden)}
              className="inline-flex w-fit items-center gap-1 rounded-sm text-label font-semibold text-muted hover:text-ink hover:underline"
            >
              {showHidden ? "Hide" : "Show"} {hiddenOnes.length} hidden report{hiddenOnes.length === 1 ? "" : "s"}
              <svg viewBox="0 0 16 16" className={`size-4 transition-transform ${showHidden ? "rotate-180" : ""}`} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6 L8 10 L12 6" />
              </svg>
            </button>
            {showHidden && (
              <ol className="flex flex-col divide-y divide-rule rounded-lg border border-dashed border-edge/40 bg-cream/40 opacity-90">
                {hiddenOnes.map(reportItem)}
              </ol>
            )}
          </div>
        )}
      </section>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
