import type { Area, AreaKind, HoursRule, Place } from "./types";

// Places golfers asked for (added_places in the database). Until an admin
// approves one, only the golfer who asked can see it, post there, or read its
// reports; the database enforces that (supabase/migrations/20261129010000_added_places.sql).

export type AddedStatus = "pending" | "approved" | "rejected";

export type AddedPlaceRow = {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  lat: number;
  lon: number;
  kind: Place["kind"];
  areas: Area[];
  hours: HoursRule[] | "24/7";
  hours_note: string;
  website: string;
  status: AddedStatus;
  admin_note: string | null;
  created_at: string;
  decided_at: string | null;
};

export const ADDED_PLACE_FIELDS = "id, name, neighborhood, address, lat, lon, kind, areas, hours, hours_note, website, status, admin_note, created_at, decided_at";

export const isAddedId = (id: string) => /^added-[a-z0-9]{6,20}$/.test(id);

export function toPlace(r: AddedPlaceRow, mine: boolean): Place {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    neighborhood: r.neighborhood,
    address: r.address,
    lat: r.lat,
    lon: r.lon,
    website: r.website,
    areas: r.areas,
    hours: r.hours,
    hoursNote: r.hours_note ? `From the golfer who added it: ${r.hours_note}` : "Hours from the golfer who added it.",
    seasons: [],
    added: { status: r.status, mine, adminNote: r.admin_note, requestedAt: r.created_at },
  };
}

// Whether a place is private (only its requester sees it): asked for, and not approved.
export const isPrivate = (p: Place) => !!p.added && p.added.status !== "approved";

// What the request form offers, with the labels the app shows.
export const AREA_CHOICES: { kind: AreaKind; label: string }[] = [
  { kind: "range", label: "Driving range" },
  { kind: "bays", label: "Hitting bays" },
  { kind: "chipping", label: "Short game area" },
  { kind: "bunker", label: "Practice bunker" },
  { kind: "putting", label: "Putting green" },
];

// The areas a request sends: the kinds picked, in the app's order, indoor or
// outdoor together. Simulator places are one indoor "Simulator bays" area.
export function requestAreas(kind: Place["kind"], picked: AreaKind[], indoor: boolean): Area[] {
  if (kind === "sim") return [{ id: "bays", kind: "bays", label: "Simulator bays", outdoor: false }];
  return AREA_CHOICES.filter((c) => picked.includes(c.kind)).map((c) => ({ id: c.kind, kind: c.kind, label: c.label, outdoor: !indoor }));
}

// The hours a request sends: open all day, every day ("24/7"), or the same
// times every day (the admin can set different days later).
export function requestHours(allDay: boolean, open: string, close: string): HoursRule[] | "24/7" {
  return allDay ? "24/7" : [{ days: [0, 1, 2, 3, 4, 5, 6], open, close }];
}
