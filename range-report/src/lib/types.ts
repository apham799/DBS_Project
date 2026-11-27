// Shared shapes for places and reports. Places are reference data that ship in
// the code (src/data/places.ts); reports live in Supabase.

export type AreaKind = "range" | "putting" | "chipping" | "bunker" | "bays";

export type Area = {
  id: string; // unique within a place, e.g. "chipping"
  kind: AreaKind;
  label: string; // "Chipping area"
  outdoor: boolean;
};

// Opening hours in Chicago local time. "HH:MM", 24-hour. A close at or before
// the open time means it runs past midnight. Days: 0 = Sunday … 6 = Saturday.
export type HoursRule = { days: number[]; open: string; close: string };

// A published seasonal change, e.g. "Harborside closes for winter Nov 16".
// Dates are Chicago calendar dates (YYYY-MM-DD), inclusive. Without `areas`,
// it applies to the whole place.
export type SeasonRule = {
  from: string;
  to?: string;
  areas?: string[];
  condition: "closed" | "limited";
  note: string;
};

export type Place = {
  id: string;
  name: string;
  kind: "walk_in" | "sim";
  neighborhood: string;
  address: string;
  lat: number;
  lon: number;
  website: string;
  areas: Area[];
  hours: HoursRule[] | "24/7";
  hoursNote: string; // what the published hours were, and when they were checked
  seasons: SeasonRule[];
};

// What a golfer reports, in three taps.
export type Condition = "good" | "limited" | "closed";
export type Crowd = "quiet" | "some_wait" | "busy";

export type Report = {
  id: string;
  placeId: string;
  createdAt: string; // ISO timestamp
  placeOpen: boolean; // false = "it was closed when I got there"
  areas: Record<string, Condition>; // only the areas they reported on
  crowd: Crowd | null;
  note?: string | null; // public, optional, max 280 characters, no links
  source?: "account" | "guest"; // posted signed in, or as a guest
  hiddenAt?: string | null; // hidden by an admin (kept, shown only on request)
  hiddenReason?: string | null;
  upVotes?: number;
  downVotes?: number;
};
