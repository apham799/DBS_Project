import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui";
import { ReportForm } from "@/components/report-form";
import { placeById, places } from "@/data/places";

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
  if (!placeById(id)) notFound();
  return <ReportForm placeId={id} />;
}

export default function Page({ params }: PageProps<"/places/[id]/report">) {
  return (
    <Suspense fallback={<div role="status" className="flex flex-col gap-4"><span className="sr-only">Loading…</span><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full" /></div>}>
      <Content params={params} />
    </Suspense>
  );
}
