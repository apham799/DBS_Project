"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SuggestionCard } from "@/components/suggestion-card";
import { Alert, Button, ButtonLink, Card, Skeleton, TextLink } from "@/components/ui";
import { placeKindLabel } from "@/data/places";
import { chicagoParts } from "@/lib/chicago-time";
import { useDb } from "@/lib/db";
import type { Suggestion } from "@/lib/suggestions";
import type { Place } from "@/lib/types";
import { useAdminCheck } from "@/lib/use-is-admin";
import { useAllSuggestions } from "@/lib/use-all-suggestions";
import { usePlaceRequests } from "@/lib/use-place-requests";
import type { AddedPlaceRow } from "@/lib/added-places";
import { clockLabel, toMinutes } from "@/lib/chicago-time";

// The Admin page: every place's suggestions from golfers' reports in one list,
// so an admin doesn't have to open each place to find them. Confirm and End
// work here; anything that needs a form (Edit first, the hours) opens that
// place's admin boxes. Admins only: the page checks, and the database checks
// every action again.

const heading = (
  <div className="flex flex-col gap-1">
    <TextLink href="/" className="mb-2 w-fit">← All places</TextLink>
    <h1 className="text-display">Admin</h1>
    <p className="text-body text-muted">Suggestions from golfers&apos; reports at every place. Nothing changes until you confirm.</p>
  </div>
);

const shell = (children: React.ReactNode) => <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">{heading}{children}</div>;

export function AdminView() {
  const check = useAdminCheck();
  if (check === "loading") return shell(<Skeleton className="h-36 w-full" />);
  if (check === "signed-out")
    return shell(
      <Card tone="cream" className="flex flex-col gap-3">
        <p className="text-body">This page is for Range Report admins. Sign in to continue.</p>
        <ButtonLink href={`/sign-in?redirect_url=${encodeURIComponent("/admin")}`} className="w-fit">Sign in</ButtonLink>
      </Card>,
    );
  if (check === "not-admin")
    return shell(
      <Card tone="cream" className="flex flex-col gap-2">
        <p className="text-body">This page is for Range Report admins only.</p>
        <TextLink href="/" className="w-fit">Back to the places</TextLink>
      </Card>,
    );
  return shell(
    <>
      <PlaceRequests />
      <PatternsJob />
      <AllSuggestions />
    </>,
  );
}

// Places golfers asked for. Approve: a place for everyone. Not now: it stays
// private to the golfer who asked, with your note. (Their reports there are
// private until it's approved, so they aren't shown here.)
function PlaceRequests() {
  const { db } = useDb();
  const { requests, loaded, reload } = usePlaceRequests();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function decide(r: AddedPlaceRow, approve: boolean) {
    const note = approve ? null : window.prompt(`Why not add ${r.name}? The golfer who asked will see this.`, "We couldn't find it");
    if (!approve && note === null) return;
    setBusy(r.id);
    setMessage(null);
    const { error } = await db.rpc("admin_decide_place", { p_id: r.id, p_approve: approve, p_note: note });
    setBusy(null);
    if (error) setMessage({ tone: "error", text: `Couldn't ${approve ? "approve" : "decline"} it: ${error.message}` });
    else {
      setMessage({ tone: "ok", text: approve ? `${r.name} is now a place for everyone.` : `${r.name} stays private to the golfer who asked.` });
      reload();
    }
  }

  const hours = (r: AddedPlaceRow) =>
    r.hours === "24/7" ? "Open 24/7" : r.hours.map((h) => `${clockLabel(toMinutes(h.open))} – ${clockLabel(toMinutes(h.close))} daily`).join("; ");

  return (
    <section aria-labelledby="place-requests" className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-brass bg-cream/50 p-5">
      <h2 id="place-requests" className="text-heading">Place requests</h2>
      {message && (
        <p role="status" className={message.tone === "ok" ? "text-label font-semibold text-open" : "text-label font-semibold text-error"}>{message.text}</p>
      )}
      {!loaded ? (
        <Skeleton className="h-20 w-full" />
      ) : requests.length === 0 ? (
        <p className="text-body text-muted">No places waiting. Golfers can ask for one from the bottom of the place list.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-rule bg-surface p-4">
              <p className="font-display text-body font-semibold text-ink">{r.name}</p>
              <p className="text-label font-normal text-muted">
                {[r.neighborhood, r.kind === "sim" ? "Simulator bays" : r.areas.every((a) => !a.outdoor) ? "Indoor golf dome" : "Walk-in range", r.address].filter(Boolean).join(" · ")}
              </p>
              <p className="text-label text-ink">
                {r.areas.map((a) => a.label).join(", ")} · {hours(r)}
                {r.hours_note ? ` · “${r.hours_note}”` : ""}
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-label">
                <a href={`https://www.openstreetmap.org/?mlat=${r.lat}&mlon=${r.lon}#map=17/${r.lat}/${r.lon}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-green underline decoration-green/40">
                  See it on the map
                </a>
                {r.website && (
                  <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-green underline decoration-green/40">
                    Their website
                  </a>
                )}
                <span className="text-muted">Asked {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" })}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy !== null} onClick={() => decide(r, true)}>Approve</Button>
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => decide(r, false)}>Not now</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// The nightly patterns job (pg_cron, 4:10 AM Chicago): when it last ran,
// and a way to run it now, e.g. after a busy afternoon of reports.
function PatternsJob() {
  const { db } = useDb();
  const [last, setLast] = useState<{ at: string | null; places: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await db.from("place_patterns").select("computed_at");
    const rows = (data ?? []) as { computed_at: string }[];
    setLast({ at: rows.map((r) => r.computed_at).sort().at(-1) ?? null, places: rows.length });
  }, [db]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });

  return (
    <Card tone="cream" as="section" className="flex flex-col gap-2" labelledBy="patterns-job">
      <h2 id="patterns-job" className="text-heading">Patterns</h2>
      <p className="text-body text-muted">
        Rebuilt every night at 4:10 AM from all report history; place pages show them under What golfers say.
        {last && (last.at ? ` Last run ${when(last.at)}, ${last.places} place${last.places === 1 ? "" : "s"} with reports.` : " Not run yet.")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const { data, error } = await db.rpc("admin_rebuild_patterns");
            setBusy(false);
            if (error) setMessage({ tone: "error", text: `Couldn't rebuild: ${error.message}` });
            else {
              setMessage({ tone: "ok", text: `Rebuilt for ${data} place${data === 1 ? "" : "s"}.` });
              load();
            }
          }}
        >
          {busy ? "Rebuilding…" : "Rebuild now"}
        </Button>
        {message && (
          <p role="status" className={message.tone === "ok" ? "text-label font-semibold text-open" : "text-label font-semibold text-error"}>
            {message.text}
          </p>
        )}
      </div>
    </Card>
  );
}

function AllSuggestions() {
  const { db } = useDb();
  const { groups, total, loaded, error: loadError, now, dismiss, reload } = useAllSuggestions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (loadError) return <Alert tone="error" title="Couldn't load the reports">{loadError}</Alert>;
  if (!loaded || !now)
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="sr-only">Loading suggestions…</span>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );

  async function run(what: string, call: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    setDone(null);
    const { error } = await call();
    setBusy(false);
    if (error) return setError(`Couldn't ${what}: ${error.message}`);
    setDone(`Done: ${what}.`);
    reload();
  }

  const today = chicagoParts(now).dateKey;
  const apply = (place: Place, s: Suggestion) => {
    if (s.kind === "review") return run(`end the confirmed status at ${place.name}`, () => db.rpc("admin_end_rule", { p_rule_id: s.ruleId }));
    if (s.kind === "agree" || s.kind === "season")
      return run(`confirm ${s.rule.condition} at ${place.name}`, () =>
        db.rpc("admin_set_rule", { p_place_id: place.id, p_area_id: s.rule.areaId ?? "", p_condition: s.rule.condition, p_note: s.rule.note, p_starts_on: today, p_ends_on: null }),
      );
  };

  return (
    <div className="flex flex-col gap-6">
      {error && <Alert tone="error" title={error} onDismiss={() => setError(null)} />}
      {done && <p className="text-label font-semibold text-open" role="status">{done}</p>}

      <p className="text-body font-semibold text-ink">
        {total === 0
          ? "No suggestions right now: what golfers report matches what every place shows."
          : `${total} suggestion${total === 1 ? "" : "s"} at ${groups.length} place${groups.length === 1 ? "" : "s"}`}
      </p>

      {groups.map(({ place, suggestions }) => {
        const areaLabel = (id: string | null) => (id === null ? "Whole place" : (place.areas.find((a) => a.id === id)?.label ?? id));
        const placeLink = `/places/${place.id}#admin`;
        return (
          <section key={place.id} aria-labelledby={`admin-${place.id}`} className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-brass bg-cream/50 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id={`admin-${place.id}`} className="text-heading">
                <Link href={placeLink} className="rounded-sm hover:underline">{place.name}</Link>
              </h2>
              <p className="text-label font-normal text-muted">
                {placeKindLabel(place)} · {suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"}
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.key}
                  suggestion={s}
                  areaLabel={areaLabel}
                  busy={busy}
                  // The hours need the day-by-day form, on the place page.
                  onApply={s.kind === "hours" ? undefined : () => apply(place, s)}
                  editFirst={
                    s.kind === "hours" ? (
                      <ButtonLink href={placeLink} size="sm">Check the hours</ButtonLink>
                    ) : s.kind === "agree" || s.kind === "season" ? (
                      <ButtonLink href={placeLink} size="sm" variant="secondary">Edit first</ButtonLink>
                    ) : null
                  }
                  onDismiss={() => dismiss(place.id, s.key)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
