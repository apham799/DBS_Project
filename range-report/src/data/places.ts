// The places Range Report covers at launch. Shared, read-only reference data,
// so it ships in the code instead of the database (reports point at these ids).
//
// Hours and seasons were checked on Nov 16, 2026, from each place's official
// page where possible. Anything uncertain says so in `hoursNote`, and a golfer's
// report always beats a published seasonal rule (see src/lib/status.ts).

import type { Place } from "@/lib/types";

const DAILY = [0, 1, 2, 3, 4, 5, 6];

export const places: Place[] = [
  {
    id: "harborside",
    name: "Harborside Practice Facility",
    kind: "walk_in",
    neighborhood: "Far South Side",
    address: "11001 S. Doty Ave E, Chicago, IL 60628",
    lat: 41.6944,
    lon: -87.5914,
    website: "https://www.harborsidegolf.com/practice-facility/",
    areas: [
      { id: "range", kind: "range", label: "Range", outdoor: true },
      { id: "chipping", kind: "chipping", label: "Chipping & pitching", outdoor: true },
      { id: "bunker", kind: "bunker", label: "Practice bunker", outdoor: true },
      { id: "putting", kind: "putting", label: "Putting green", outdoor: true },
    ],
    // Opens 6 AM; closes 3:30 PM (golfers' reports, Nov 17: "they close by 3:30",
    // earlier than the website's "around sunset"). Weekly maintenance: closes
    // 2 PM Tuesday, opens 10 AM Wednesday.
    hours: [
      { days: [0, 1, 4, 5, 6], open: "06:00", close: "15:30" },
      { days: [2], open: "06:00", close: "14:00" },
      { days: [3], open: "10:00", close: "15:30" },
    ],
    hoursNote:
      "Opens 6 AM and closes 3:30 PM, as golfers reported on Nov 17 (the website says around sunset). Closes 2 PM Tue for maintenance and opens 10 AM Wed. Projected to close for the season Mon Nov 16, 2026, but golfers found it open, mats only, after that.",
    seasons: [
      { from: "2026-11-16", to: "2027-04-14", condition: "closed", note: "Projected closed for the season from Nov 16 (mats only if open)" },
      { from: "2026-11-11", to: "2026-11-15", areas: ["range"], condition: "limited", note: "Mats only since Nov 11" },
    ],
  },
  {
    id: "jackson-park",
    name: "Jackson Park Driving Range",
    kind: "walk_in",
    neighborhood: "Woodlawn",
    address: "6401 S. Richards Dr, Chicago, IL 60649",
    lat: 41.7848,
    lon: -87.5787,
    website: "https://jacksonpark.cpdgolf.com",
    areas: [
      { id: "range", kind: "range", label: "Range (mats)", outdoor: true },
      { id: "chipping", kind: "chipping", label: "Short-game area", outdoor: true },
      { id: "putting", kind: "putting", label: "Putting green", outdoor: true },
    ],
    // No hours are published; the course plays year-round in daylight.
    hours: [{ days: DAILY, open: "07:00", close: "16:30" }],
    hoursNote:
      "No hours published, so these are daylight hours. The site says the range is closed for the season from 11/9, but the notice has no year. Call 773-496-5015.",
    seasons: [{ from: "2026-11-09", to: "2027-04-14", areas: ["range"], condition: "closed", note: "Site says closed for the season from Nov 9 (notice has no year)" }],
  },
  {
    id: "diversey",
    name: "Diversey Driving Range",
    kind: "walk_in",
    neighborhood: "Lakeview",
    address: "141 W. Diversey Pkwy, Chicago, IL 60614",
    lat: 41.9333,
    lon: -87.6341,
    website: "https://diversey.cpdgolf.com",
    areas: [
      { id: "range", kind: "range", label: "Range (two tiers)", outdoor: true },
      { id: "bays", kind: "bays", label: "Heated stalls", outdoor: true },
      { id: "putting", kind: "putting", label: "Putting greens", outdoor: true },
    ],
    hours: [{ days: DAILY, open: "09:00", close: "21:00" }],
    hoursNote: "Daily 9 AM – 9 PM, last bucket 8 PM. Open in winter with heated stalls; winter hours not separately published. 773-661-0105.",
    seasons: [],
  },
  {
    id: "cog-hill",
    name: "Cog Hill Practice Facility",
    kind: "walk_in",
    neighborhood: "Lemont",
    address: "12294 Archer Ave, Lemont, IL 60439",
    lat: 41.665,
    lon: -87.9614,
    website: "https://coghillgolf.com/range/",
    areas: [
      { id: "range", kind: "range", label: "Range (Toptracer)", outdoor: true },
      { id: "bays", kind: "bays", label: "Heated stalls", outdoor: true },
      { id: "chipping", kind: "chipping", label: "Short-game area", outdoor: true },
      { id: "bunker", kind: "bunker", label: "Practice bunker", outdoor: true },
      { id: "putting", kind: "putting", label: "Putting greens", outdoor: true },
    ],
    hours: [
      { days: [1], open: "10:00", close: "20:00" },
      { days: [0, 2, 3, 4], open: "08:00", close: "20:00" },
      { days: [5, 6], open: "08:00", close: "21:00" },
    ],
    hoursNote: "Winter hours (Nov 1 – Mar 31), mats only. Closed Christmas Day. Whether the short-game areas stay open in winter isn't published.",
    seasons: [{ from: "2026-11-01", to: "2027-03-31", areas: ["range"], condition: "limited", note: "Mats only, Nov 1 – Mar 31" }],
  },
  {
    // Added Nov 27, 2026 (checked that day on dpparks.org/golf-center and /golf-center-hours).
    id: "golf-center-des-plaines",
    name: "Golf Center Des Plaines",
    kind: "walk_in",
    neighborhood: "Des Plaines",
    address: "353 N. River Road, Des Plaines, IL 60018",
    lat: 42.0583,
    lon: -87.8841,
    website: "https://www.dpparks.org/golf-center/",
    areas: [
      { id: "bays", kind: "bays", label: "Heated stalls", outdoor: true },
      { id: "range", kind: "range", label: "Grass tees", outdoor: true },
      { id: "chipping", kind: "chipping", label: "Short game area", outdoor: true },
      { id: "bunker", kind: "bunker", label: "Practice bunkers", outdoor: true },
    ],
    hours: [{ days: DAILY, open: "09:00", close: "22:00" }],
    hoursNote:
      "Winter hours (Nov 1 – Feb 28): driving range 9 AM – 10 PM daily, 80 lit, individually heated stations. Short game area 9 AM until 1½ hours before sunset, weather permitting. Grass tees aren't in the winter hours. Dec 24 9 AM – 5 PM, Dec 31 9 AM – 6 PM, closed Dec 25.",
    seasons: [
      { from: "2026-11-01", to: "2027-02-28", areas: ["range"], condition: "closed", note: "Grass tees aren't in the published winter hours (Nov 1 – Feb 28)" },
      { from: "2026-12-25", to: "2026-12-25", condition: "closed", note: "Closed Christmas Day" },
    ],
  },
  {
    // Added Nov 27, 2026 (checked that day on mistwoodgolfdome.com and /hours).
    id: "mistwood-golf-dome",
    name: "Mistwood Golf Dome",
    kind: "walk_in",
    neighborhood: "Bolingbrook",
    address: "730 N Bolingbrook Dr, Bolingbrook, IL 60440",
    lat: 41.7217,
    lon: -88.066,
    website: "https://mistwoodgolfdome.com/",
    areas: [
      { id: "bays", kind: "bays", label: "Toptracer bays", outdoor: false },
      { id: "chipping", kind: "chipping", label: "Short game area", outdoor: false },
      { id: "putting", kind: "putting", label: "Putting green", outdoor: false },
    ],
    hours: [
      { days: [1, 2, 3, 4, 5], open: "08:00", close: "22:00" },
      { days: [6], open: "07:00", close: "22:00" },
      { days: [0], open: "07:00", close: "21:00" },
    ],
    hoursNote:
      "A fully heated indoor dome, open year-round: 30 Toptracer hitting bays (booked by the hour), a 900 sq ft putting green, a short game area and simulator suites. Dec 24 8 AM – 2 PM, Dec 31 8 AM – 6 PM, closed Dec 25.",
    seasons: [{ from: "2026-12-25", to: "2026-12-25", condition: "closed", note: "Closed Christmas Day" }],
  },
  {
    id: "pga-superstore-lincoln-park",
    name: "PGA TOUR Superstore Lincoln Park",
    kind: "sim",
    neighborhood: "Lincoln Park",
    address: "1745 W. Fullerton Ave, Chicago, IL 60614",
    lat: 41.9235,
    lon: -87.6713,
    website: "https://www.pgatoursuperstore.com/stores/detail?StoreID=1243",
    areas: [
      { id: "bays", kind: "bays", label: "Practice bays", outdoor: false },
      { id: "putting", kind: "putting", label: "Indoor putting green", outdoor: false },
    ],
    hours: [
      { days: [1, 2, 3, 4, 5, 6], open: "09:00", close: "20:00" },
      { days: [0], open: "10:00", close: "18:00" },
    ],
    hoursNote: "Store hours; bays are booked online. Bay hours aren't published separately.",
    seasons: [],
  },
  {
    id: "five-iron-bucktown",
    name: "Five Iron Golf Bucktown",
    kind: "sim",
    neighborhood: "Bucktown",
    address: "2131 N. Elston Ave, Chicago, IL 60614",
    lat: 41.9203,
    lon: -87.6704,
    website: "https://fiveirongolf.com/locations/chicago-bucktown",
    areas: [{ id: "bays", kind: "bays", label: "Simulator bays", outdoor: false }],
    hours: [
      { days: [0, 1, 2, 3, 4], open: "06:00", close: "23:00" },
      { days: [5, 6], open: "06:00", close: "01:00" },
    ],
    hoursNote: "Sun – Thu 6 AM – 11 PM, Fri – Sat 6 AM – 1 AM. Bays are booked.",
    seasons: [],
  },
  {
    id: "parennial-lincoln-park",
    name: "PARennial Golf Lincoln Park",
    kind: "sim",
    neighborhood: "Lincoln Park",
    address: "2355 N. Clark St, Chicago, IL 60614",
    lat: 41.9252,
    lon: -87.6401,
    website: "https://parennialgolf.com/locations/lincoln-park",
    areas: [
      { id: "bays", kind: "bays", label: "TrackMan bays", outdoor: false },
      { id: "putting", kind: "putting", label: "Putting green", outdoor: false },
    ],
    hours: "24/7",
    hoursNote: "Open 24/7, unstaffed; you unlock the door in their app. Non-members book from tomorrow up to 6 days ahead.",
    seasons: [],
  },
];

export const placeById = (id: string) => places.find((p) => p.id === id);

// What kind of place it is, in a few words: simulators, an indoor dome (walk-in,
// nothing outdoors), or a walk-in range.
export const placeKindLabel = (p: Place) =>
  p.kind === "sim" ? "Simulator bays" : p.areas.every((a) => !a.outdoor) ? "Indoor golf dome" : "Walk-in range";
