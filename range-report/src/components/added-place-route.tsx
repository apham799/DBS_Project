"use client";

import { PlaceView } from "@/components/place-view";
import { ReportForm } from "@/components/report-form";
import { Card, Skeleton, TextLink } from "@/components/ui";
import { usePlaces } from "@/lib/use-places";

// The page for a place a golfer asked for. It lives in the database, and
// until it's approved only they can see it, so it's looked up here in the
// browser (as whoever is signed in) rather than when the page is built.
export function AddedPlaceRoute({ id, view }: { id: string; view: "place" | "report" }) {
  const { byId, loaded } = usePlaces();
  const place = byId(id);
  if (place) return view === "place" ? <PlaceView place={place} /> : <ReportForm place={place} />;
  if (!loaded)
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="sr-only">Loading…</span>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <TextLink href="/" className="w-fit">← All places</TextLink>
      <Card tone="cream" className="flex flex-col gap-2">
        <h1 className="text-heading">This place isn&apos;t here</h1>
        <p className="text-body text-muted">
          It may still be waiting for review, and only the golfer who asked for it can see it until then. If that&apos;s you, sign in with the same account.
        </p>
      </Card>
    </div>
  );
}
