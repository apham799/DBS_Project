"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

// Where a requested place is: search for its address (OpenStreetMap's
// Nominatim, only when the golfer presses Search, as its usage policy asks),
// or click the map. Starts over Chicago.

export type LatLon = { lat: number; lon: number };
type Hit = { display_name: string; lat: string; lon: string };

const CHICAGO: [number, number] = [41.88, -87.63];
const input = "h-10 min-w-0 flex-1 rounded-md border-2 border-edge bg-surface px-3 text-body";

export function LocationPicker({ value, onChange, onFound }: { value: LatLon | null; onChange: (p: LatLon) => void; onFound?: (address: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const pin = useRef<Marker | null>(null);
  const place = useRef<((p: LatLon, zoom?: number) => void) | null>(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  }, [onChange]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: LMap | null = null;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !box.current) return;
      created = L.map(box.current, { scrollWheelZoom: false }).setView(value ? [value.lat, value.lon] : CHICAGO, value ? 15 : 9);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(created);
      const icon = L.divIcon({
        className: "rr-pin",
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        html: `<svg viewBox="0 0 30 40" width="30" height="40" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 2px rgb(0 0 0 / .3))"><path d="M15 38.5C15 38.5 2.5 24 2.5 15a12.5 12.5 0 0 1 25 0c0 9-12.5 23.5-12.5 23.5z" fill="var(--color-green)" stroke="#fff" stroke-width="2"/><circle cx="15" cy="15" r="5" fill="#fff"/></svg>`,
      });
      const m = created;
      place.current = (p, zoom) => {
        if (!pin.current) pin.current = L.marker([p.lat, p.lon], { icon, draggable: true, keyboard: true, title: "The place" }).addTo(m);
        pin.current.setLatLng([p.lat, p.lon]);
        pin.current.off("dragend").on("dragend", () => {
          const ll = pin.current!.getLatLng();
          changed.current({ lat: ll.lat, lon: ll.lng });
        });
        if (zoom) m.setView([p.lat, p.lon], zoom);
      };
      if (value) place.current(value);
      created.on("click", (e) => {
        const p = { lat: e.latlng.lat, lon: e.latlng.lng };
        place.current?.(p);
        changed.current(p);
      });
      map.current = created;
    });
    return () => {
      cancelled = true;
      created?.remove();
      map.current = null;
      pin.current = null;
    };
    // Made once; the pin follows clicks, drags and searches from here on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`, { headers: { "Accept-Language": "en" } });
      if (!res.ok) throw new Error(String(res.status));
      setHits((await res.json()) as Hit[]);
    } catch {
      setSearchError("Search isn't working right now. Click the map where the place is instead.");
    } finally {
      setSearching(false);
    }
  }

  function pick(h: Hit) {
    const p = { lat: Number(h.lat), lon: Number(h.lon) };
    place.current?.(p, 16);
    onChange(p);
    onFound?.(h.display_name);
    setHits(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          className={input}
          value={query}
          placeholder="Search for the address or name"
          aria-label="Search for the place on the map"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" size="sm" variant="secondary" disabled={searching || query.trim().length < 3} onClick={search} className="h-10">
          {searching ? "Searching…" : "Search"}
        </Button>
      </div>
      {searchError && <p className="text-label font-semibold text-error">{searchError}</p>}
      {hits && (
        <ul className="flex flex-col divide-y divide-rule rounded-md border border-rule bg-surface" aria-label="Search results">
          {hits.length === 0 && <li className="px-3 py-2 text-body text-muted">Nothing found. Try the town, or click the map.</li>}
          {hits.map((h) => (
            <li key={`${h.lat},${h.lon}`}>
              <button type="button" onClick={() => pick(h)} className="w-full px-3 py-2 text-left text-body hover:bg-cream">
                {h.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="isolate h-72 overflow-hidden rounded-lg border border-rule">
        <div ref={box} className="h-full w-full" role="region" aria-label="Map: click where the place is" />
      </div>
      <p className="text-label font-normal text-muted">
        {value ? `Pin at ${value.lat.toFixed(4)}, ${value.lon.toFixed(4)}. Drag it, or click the map, to move it.` : "Click the map where the place is, or search above."}
      </p>
    </div>
  );
}
