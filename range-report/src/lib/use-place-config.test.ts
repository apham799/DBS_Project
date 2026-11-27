import { describe, expect, it } from "vitest";
import { places } from "@/data/places";
import { hoursNow } from "./hours";
import { merge, type PlaceConfig } from "./use-place-config";

describe("merging admin settings into a place", () => {
  const harborside = places.find((p) => p.id === "harborside")!;
  const config: PlaceConfig = {
    rules: [{ id: "r1", placeId: "harborside", areaId: "range", condition: "limited", note: "Mats only", startsOn: "2026-11-16", endsOn: null }],
    hours: { harborside: { hours: [{ days: [0, 1, 2, 3, 4, 5, 6], open: "07:00", close: "15:00" }], note: "Winter hours", updatedAt: "2026-11-28T15:00:00Z" } },
  };

  it("adds the place's confirmed statuses and replaces its hours", () => {
    const m = merge(harborside, config);
    expect(m.confirmed).toHaveLength(1);
    expect(m.hoursUpdated).toEqual({ note: "Winter hours", updatedAt: "2026-11-28T15:00:00Z" });
    // Sat Nov 28, 3:30 PM Chicago: closed by the admin's 3 PM close.
    expect(hoursNow(m.hours, new Date("2026-11-28T21:30:00Z")).open).toBe(false);
  });

  it("leaves other places, and places with nothing set, as they are", () => {
    const diversey = places.find((p) => p.id === "diversey")!;
    expect(merge(diversey, config)).toBe(diversey);
    expect(merge(harborside, { rules: [], hours: {} })).toBe(harborside);
  });
});
