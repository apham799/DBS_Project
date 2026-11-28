"use client";

import Link from "next/link";
import { Alert, Button, ButtonLink, Card, Skeleton, TextLink } from "@/components/ui";
import { ReportChips, SettingBadge } from "@/components/status";
import { placeKindLabel } from "@/data/places";
import { usePlaces } from "@/lib/use-places";
import type { Place } from "@/lib/types";
import { settingOf } from "@/lib/filters";
import { useLog, type Changed, type LogEntry } from "@/lib/use-log";

// "My Log": every session you posted, newest first. The private note is the
// reason to post at all, so this is where it pays off. Only you see this page's
// contents; the shared parts are marked as shared.

const when = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const changedLabel: Record<Changed, string> = {
  time: "Went at a different time",
  place: "Went somewhere else",
  plan: "Changed what I practiced",
  packed: "Packed differently",
  no: "No change",
};

function Entry({ entry, place }: { entry: LogEntry; place: Place | undefined }) {
  return (
    <li>
      <Card as="article" className="flex flex-col gap-3">
        {/* Same header as the place cards on Home: name, indoor/outdoor, where and what. */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-heading">
              {place ? (
                <Link href={`/places/${place.id}`} className="rounded-sm hover:underline">{place.name}</Link>
              ) : (
                entry.placeId
              )}
            </h2>
            {place && (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-normal text-muted">
                <SettingBadge setting={settingOf(place)} />
                <span>{place.neighborhood} · {placeKindLabel(place)}</span>
              </p>
            )}
          </div>
          <p className="text-label font-normal text-muted">{when.format(new Date(entry.createdAt))}</p>
        </div>

        {entry.note ? (
          <div className="flex flex-col gap-0.5">
            <p className="text-label text-muted">What you worked on · just for you</p>
            <p className="whitespace-pre-line text-body">{entry.note}</p>
          </div>
        ) : (
          <p className="text-body text-muted">No practice note this time.</p>
        )}

        {entry.report && place && (
          <div className="flex flex-col gap-2 border-t border-rule pt-3">
            <p className="text-label text-muted">What you reported · shared without your name</p>
            <ReportChips place={place} report={entry.report} mine />
            {entry.report.note && <p className="text-body italic text-ink/80">&ldquo;{entry.report.note}&rdquo;</p>}
          </div>
        )}

        {entry.changed && (
          <p className="text-label text-muted">
            Did Range Report change this trip? <span className="font-semibold text-ink">{changedLabel[entry.changed]}</span>
          </p>
        )}
      </Card>
    </li>
  );
}

export function LogView() {
  const { state, retry } = useLog();
  const { byId } = usePlaces();

  const heading = (
    <div className="flex flex-col gap-1">
      <TextLink href="/" className="mb-2 w-fit">← All places</TextLink>
      <h1 className="text-display">My Log</h1>
      <p className="text-body text-muted">Every session you posted, with what you worked on. Only you can see this page.</p>
    </div>
  );

  if (state.status === "signed_out") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {heading}
        <Card tone="cream" className="flex flex-col gap-3">
          <p className="text-body">Sign in to see your practice log.</p>
          <ButtonLink href={`/sign-in?redirect_url=${encodeURIComponent("/log")}`} className="w-fit">Sign in</ButtonLink>
        </Card>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {heading}
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">Loading your log…</span>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {heading}
        <Alert tone="error" title="Couldn't load your log" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>
          Your notes are saved; this page just couldn&apos;t reach them.
        </Alert>
      </div>
    );
  }

  const { entries } = state;
  const changed = entries.filter((e) => e.changed && e.changed !== "no").length;
  const places = new Set(entries.map((e) => e.placeId)).size;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {heading}
      {entries.length === 0 ? (
        <Card tone="cream" className="flex flex-col gap-2">
          <p className="text-body">No sessions yet. After your next practice, post a report and add what you worked on. It shows up here.</p>
          <TextLink href="/" className="w-fit">Find your place</TextLink>
        </Card>
      ) : (
        <>
          <p className="text-body text-muted">
            {entries.length} {entries.length === 1 ? "session" : "sessions"} at {places} {places === 1 ? "place" : "places"}
            {changed > 0 && ` · Range Report changed ${changed} ${changed === 1 ? "trip" : "trips"}`}
          </p>
          {/* One column, newest first: a log reads top to bottom by time, and
              two columns of different-height entries left holes beside the short ones. */}
          <ol className="flex flex-col gap-4">
            {entries.map((e) => <Entry key={e.id} entry={e} place={byId(e.placeId)} />)}
          </ol>
        </>
      )}
    </div>
  );
}
