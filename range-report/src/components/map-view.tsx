"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { LeafletMap } from "@/components/leaflet-map";
import { PlaceFilters } from "@/components/place-filters";
import { AreaDots, headline, HoursBadge, NoDataIcon, SettingBadge } from "@/components/status";
import { Alert, Button, ButtonLink, cx, Skeleton, TextLink } from "@/components/ui";
import { placeKindLabel } from "@/data/places";
import { matches, NO_FILTERS, settingOf } from "@/lib/filters";
import { ageLabel, type PlaceStatus } from "@/lib/status";
import { setReportSource } from "@/lib/use-report-source";
import { useFilters } from "@/lib/use-filters";
import { usePlaceStatuses } from "@/lib/use-place-statuses";
import type { Place } from "@/lib/types";

// The city map (/map): every place as a pin, colored by its hours badge, with
// the same filters as Home (and the same saved filter settings). Picking a pin
// or a place in the list opens its card over the map.

export function MapView() {
  const { places, statuses, now, loaded, error, retry } = usePlaceStatuses();
  const [filters, setFilters] = useFilters();
  const [selected, setSelected] = useState<string | null>(null);
  const [fitAll, setFitAll] = useState(0);
  const mapBox = useRef<HTMLDivElement>(null);
  // From the list: on phones the list is under the map, so bring the map (and the card) into view.
  const pickFromList = (id: string | null) => {
    setSelected(id);
    if (id && !window.matchMedia("(min-width: 1024px)").matches) {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      mapBox.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    }
  };
  const shown = useMemo(() => places.filter((p) => matches(p, statuses?.[p.id], filters)), [places, statuses, filters]);
  const visible = useMemo(() => new Set(shown.map((p) => p.id)), [shown]);
  // A place the filters just hid isn't shown as picked.
  const picked = selected && visible.has(selected) ? places.find((p) => p.id === selected)! : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <TextLink href="/" className="mb-2 w-fit">← All places</TextLink>
        <h1 className="text-display">Map</h1>
        <p className="text-body text-muted">Every place in and around Chicago. Pins show whether it&apos;s open now; pick one for what golfers report.</p>
      </div>

      {error && (
        <Alert tone="error" title="Couldn't load reports" action={<Button size="sm" variant="secondary" onClick={retry}>Try again</Button>}>
          Pins show published hours and seasons only.
        </Alert>
      )}

      <PlaceFilters filters={filters} onChange={setFilters} shown={shown.length} total={places.length} />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* isolate: Leaflet's layers stack inside here, under the sticky header. */}
        <div ref={mapBox} className="relative isolate h-[60vh] min-h-[420px] overflow-hidden rounded-xl border border-rule shadow-card lg:col-span-8 lg:h-[70vh]">
          <LeafletMap places={places} statuses={statuses} visible={visible} selected={picked?.id ?? null} onSelect={setSelected} fitAll={fitAll} />
          {/* Beside the zoom buttons. */}
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setFitAll((n) => n + 1);
            }}
            className="absolute left-[3.25rem] top-[10px] z-[500] h-[34px] rounded-md border-2 border-black/20 bg-surface px-2.5 text-label font-semibold text-ink shadow-card hover:bg-cream"
          >
            Show all
          </button>
          <PinKey />
          {picked && statuses && now && (
            <PlacePopup place={picked} status={statuses[picked.id]} now={now} onClose={() => setSelected(null)} />
          )}
        </div>

        <section aria-labelledby="map-list" className="flex flex-col gap-3 lg:col-span-4">
          <h2 id="map-list" className="text-heading">
            {shown.length === places.length ? "All places" : `${shown.length} of ${places.length} places`}
          </h2>
          {!loaded || !statuses ? (
            <div className="flex flex-col gap-2" role="status">
              <span className="sr-only">Loading places…</span>
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-lg border-2 border-dashed border-edge/40 bg-cream/60 p-5">
              <p className="text-body">No places match all of those.</p>
              <Button size="sm" variant="secondary" onClick={() => { setFilters(NO_FILTERS); setReportSource("everyone"); }}>
                Clear filters
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
              {shown.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={picked?.id === p.id}
                    onClick={() => pickFromList(picked?.id === p.id ? null : p.id)}
                    className={cx(
                      "flex w-full flex-col items-start gap-1.5 rounded-lg border bg-surface px-4 py-3 text-left transition-colors hover:bg-cream/50",
                      picked?.id === p.id ? "border-green ring-2 ring-green/30" : "border-rule",
                    )}
                  >
                    <span className="font-display text-body font-semibold text-ink">{p.name}</span>
                    <span className="text-label font-normal text-muted">{p.neighborhood} · {placeKindLabel(p)}</span>
                    <HoursBadge hours={statuses[p.id].hours} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// What the pin colors mean, in the map's corner.
function PinKey() {
  const dot = "inline-block size-2.5 rounded-full";
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[500] flex flex-col gap-1 rounded-md border border-rule bg-surface/95 px-3 py-2 text-label text-ink shadow-card" aria-hidden>
      <span className="flex items-center gap-1.5"><span className={cx(dot, "bg-hours-green")} />Open</span>
      <span className="flex items-center gap-1.5"><span className={cx(dot, "bg-hours-yellow")} />Closes within the hour</span>
      <span className="flex items-center gap-1.5"><span className={cx(dot, "bg-hours-red")} />Closed</span>
    </div>
  );
}

// The picked place, in a card over the bottom of the map.
function PlacePopup({ place, status, now, onClose }: { place: Place; status: PlaceStatus; now: Date; onClose: () => void }) {
  const line = headline(status);
  return (
    <div
      role="dialog"
      aria-labelledby="map-popup-title"
      className="absolute inset-x-3 bottom-3 z-[500] flex max-h-[70%] flex-col gap-3 overflow-y-auto rounded-lg border border-rule bg-surface p-4 shadow-lift motion-safe:animate-[rr-menu-in_150ms_ease-out] sm:left-auto sm:w-96"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="map-popup-title" className="text-heading">
            <Link href={`/places/${place.id}`} className="rounded-sm hover:underline">{place.name}</Link>
          </h2>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-normal text-muted">
            <SettingBadge setting={settingOf(place)} />
            <span>{place.neighborhood} · {placeKindLabel(place)}</span>
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded-md p-1.5 text-muted hover:bg-cream hover:text-ink">
          <svg viewBox="0 0 16 16" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4 L12 12 M12 4 L4 12" />
          </svg>
        </button>
      </div>
      <HoursBadge hours={status.hours} />
      {line && <p className="text-body font-semibold">{line}</p>}
      <AreaDots status={status} />
      <p className="flex items-center gap-1.5 text-label text-muted">
        <span className="font-semibold">Golfer report</span>
        {status.lastReportAt ? (
          <span className="text-ink">{ageLabel(now.getTime() - new Date(status.lastReportAt).getTime())}</span>
        ) : (
          <span className="inline-flex items-center gap-1"><NoDataIcon className="size-4" />None yet</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/places/${place.id}`} size="sm">Open place</ButtonLink>
        <ButtonLink href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`} size="sm" variant="secondary" target="_blank" rel="noopener noreferrer">
          Directions
        </ButtonLink>
      </div>
    </div>
  );
}
