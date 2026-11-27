"use client";

import Link from "next/link";
import { useState } from "react";
import { SuggestionCard } from "@/components/suggestion-card";
import { Alert, ButtonLink, Card, Skeleton, TextLink } from "@/components/ui";
import { placeKindLabel } from "@/data/places";
import { chicagoParts } from "@/lib/chicago-time";
import { useDb } from "@/lib/db";
import type { Suggestion } from "@/lib/suggestions";
import type { Place } from "@/lib/types";
import { useAdminCheck } from "@/lib/use-is-admin";
import { useAllSuggestions } from "@/lib/use-all-suggestions";

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
  return shell(<AllSuggestions />);
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
