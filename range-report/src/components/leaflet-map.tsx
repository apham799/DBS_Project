"use client";

import "leaflet/dist/leaflet.css";
import type { DivIcon, Map as LMap, Marker } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { hoursTone, type HoursTone } from "@/components/status";
import { cx } from "@/components/ui";
import type { PlaceStatus } from "@/lib/status";
import type { Place } from "@/lib/types";

// The city map's map: OpenStreetMap tiles through Leaflet, one pin per place,
// colored like the hours badge (open, closing within the hour, closed).
// Leaflet needs the browser, so it's loaded after mount. Pins are keyboard
// reachable (Tab, then Enter); the list beside the map does the same thing.

const PIN: Record<HoursTone | "unknown", string> = {
  open: "var(--color-hours-green)",
  soon: "var(--color-hours-yellow)",
  closed: "var(--color-hours-red)",
  unknown: "var(--color-disabled)",
};

function pinHtml(color: string, selected: boolean) {
  const w = selected ? 38 : 30;
  const h = selected ? 50 : 40;
  return `<svg viewBox="0 0 30 40" width="${w}" height="${h}" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 2px rgb(0 0 0 / .3))">
    <path d="M15 38.5C15 38.5 2.5 24 2.5 15a12.5 12.5 0 0 1 25 0c0 9-12.5 23.5-12.5 23.5z" fill="${color}" stroke="${selected ? "var(--color-ink)" : "#fff"}" stroke-width="${selected ? 2.5 : 2}"/>
    <circle cx="15" cy="15" r="5" fill="#fff"/>
  </svg>`;
}

export function LeafletMap({
  places,
  statuses,
  visible,
  selected,
  onSelect,
  fitAll,
}: {
  places: Place[];
  statuses: Record<string, PlaceStatus> | null;
  visible: Set<string>; // the places the filters keep
  selected: string | null;
  onSelect: (id: string) => void;
  fitAll: number; // bump to zoom back out to every place
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LMap | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const icon = useRef<((color: string, selected: boolean) => DivIcon) | null>(null);
  const newMarker = useRef<((lat: number, lon: number, name: string) => Marker) | null>(null);
  const [ready, setReady] = useState(false);
  // The zoom hint, and the key it names ("Ctrl", or "⌘" on a Mac).
  const [hint, setHint] = useState(false);
  const [hintKey, setHintKey] = useState("Ctrl");
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let created: LMap | null = null;
    const pins = markers.current;
    import("leaflet").then(({ default: L }) => {
      if (cancelled || !box.current) return;
      // Plain scrolling scrolls the page; Ctrl/⌘ + scroll zooms (below).
      // zoomSnap 0.25 so a trackpad pinch zooms smoothly, not in big jumps.
      created = L.map(box.current, { scrollWheelZoom: false, zoomControl: true, zoomSnap: 0.25 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(created);
      created.fitBounds(L.latLngBounds(places.map((p) => [p.lat, p.lon])), { padding: [40, 40] });
      icon.current = (color, sel) =>
        L.divIcon({ html: pinHtml(color, sel), className: "rr-pin", iconSize: sel ? [38, 50] : [30, 40], iconAnchor: sel ? [19, 50] : [15, 40] });
      // Pins themselves are made below, as places arrive (requested ones load later).
      newMarker.current = (lat, lon, name) => L.marker([lat, lon], { icon: icon.current!(PIN.unknown, false), title: name, alt: name, keyboard: true, riseOnHover: true });
      map.current = created;
      setReady(true);
    });
    return () => {
      cancelled = true;
      created?.remove();
      map.current = null;
      pins.clear();
    };
    // Made once; the first fit uses the places known then (the built-in ones at least).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pins: color by status, only the places the filters keep, the selected one bigger and on top.
  useEffect(() => {
    if (!ready || !map.current || !icon.current || !newMarker.current) return;
    // Places that went away (a request you can no longer see): drop their pins.
    for (const [id, m] of markers.current) {
      if (!places.some((p) => p.id === id)) {
        m.remove();
        markers.current.delete(id);
      }
    }
    for (const p of places) {
      let m = markers.current.get(p.id);
      if (!m) {
        m = newMarker.current(p.lat, p.lon, p.name);
        m.on("click", () => select.current(p.id));
        markers.current.set(p.id, m);
      }
      const s = statuses?.[p.id];
      const sel = p.id === selected;
      m.setIcon(icon.current(s ? PIN[hoursTone(s.hours)] : PIN.unknown, sel));
      m.setZIndexOffset(sel ? 1000 : 0);
      m.options.title = s ? `${p.name}: ${s.hours.label}` : p.name;
      m.getElement()?.setAttribute("title", m.options.title);
      m.getElement()?.setAttribute("aria-pressed", String(sel));
      if (visible.has(p.id)) m.addTo(map.current);
      else m.remove();
    }
  }, [ready, places, statuses, visible, selected]);

  // Picked (a pin or the list): zoom in on it, so pins that overlap from far
  // out (four places in Lincoln Park) spread apart, with the pin a little
  // above the middle, clear of the card over the bottom of the map.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !selected) return;
    const p = places.find((x) => x.id === selected);
    if (!p) return;
    const zoom = Math.max(m.getZoom(), 13);
    const target = m.unproject(m.project([p.lat, p.lon], zoom).add([0, m.getSize().y * 0.22]), zoom);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) m.setView(target, zoom, { animate: false });
    else m.flyTo(target, zoom, { duration: 0.6 });
  }, [ready, selected, places]);

  // "Show all": back out to every place.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || fitAll === 0) return;
    import("leaflet").then(({ default: L }) => {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      m.flyToBounds(L.latLngBounds(places.map((p) => [p.lat, p.lon])), { padding: [40, 40], duration: still ? 0 : 0.6, animate: !still });
    });
  }, [ready, fitAll, places]);

  // Ctrl (⌘ on a Mac) + scroll zooms around the pointer, like most map sites;
  // a trackpad pinch arrives as the same thing. Plain scrolling is left to the
  // page, with a short hint over the map. Dragging moves the map (Leaflet's own).
  useEffect(() => {
    const el = box.current;
    const m = map.current;
    if (!ready || !el || !m) return;
    const key = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
    let pending = 0;
    let frame = 0;
    let at: MouseEvent | null = null;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        setHintKey(key);
        setHint(true);
        clearTimeout(hide);
        hide = setTimeout(() => setHint(false), 1200);
        return;
      }
      e.preventDefault();
      setHint(false);
      // One mouse-wheel notch (about 100) is one zoom level; pinches add up in small steps.
      pending += -(e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY) / 100;
      at = e;
      if (!frame)
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (Math.abs(pending) < 0.25 || !at) return;
          const step = Math.round(pending * 4) / 4;
          pending -= step;
          const zoom = Math.min(m.getMaxZoom(), Math.max(m.getMinZoom(), m.getZoom() + step));
          m.setZoomAround(m.mouseEventToLatLng(at), zoom, { animate: false });
        });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(frame);
      clearTimeout(hide);
    };
  }, [ready]);

  return (
    <>
      <div ref={box} className="h-full w-full" aria-label="Map of the places" role="region" />
      <div
        aria-hidden
        className={cx(
          "pointer-events-none absolute inset-0 z-[600] flex items-center justify-center bg-ink/35 transition-opacity duration-300",
          hint ? "opacity-100" : "opacity-0",
        )}
      >
        <p className="rounded-md bg-ink/80 px-4 py-2 text-body font-semibold text-on-green">
          Hold {hintKey} and scroll to zoom
        </p>
      </div>
    </>
  );
}
