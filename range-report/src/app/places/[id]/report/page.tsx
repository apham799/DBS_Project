import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { ReportForm } from "@/components/report-form";
import { AddedPlaceRoute } from "@/components/added-place-route";
import { placeById, places } from "@/data/places";
import { isAddedId } from "@/lib/added-places";

export function generateStaticParams() {
  return places.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/places/[id]/report">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Report: ${placeById(id)?.name ?? "Place"}` };
}

// The id is read inside <Suspense>, so the page shell (header, layout) is
// instant and only this part waits for the route params.
async function Content({ params }: { params: PageProps<"/places/[id]/report">["params"] }) {
  const { id } = await params;
  const place = placeById(id);
  if (place) return <ReportForm place={place} />;
  // A place a golfer asked for: loaded in the browser, where we know who's asking.
  if (isAddedId(id)) return <AddedPlaceRoute id={id} view="report" />;
  notFound();
}

export default function Page({ params }: PageProps<"/places/[id]/report">) {
  return (
    <Suspense fallback={<div role="status" className="flex flex-col gap-4"><span className="sr-only">Loading…</span><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full" /></div>}>
      <Content params={params} />
    </Suspense>
  );
}
