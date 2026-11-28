import { describe, expect, it } from "vitest";
import { isAddedId, isPrivate, requestAreas, requestHours, toPlace, type AddedPlaceRow } from "./added-places";

const row = (r: Partial<AddedPlaceRow> = {}): AddedPlaceRow => ({
  id: "added-ab12cd34ef",
  name: "Lakeshore Range",
  neighborhood: "Milwaukee, WI",
  address: "",
  lat: 43.04,
  lon: -87.91,
  kind: "walk_in",
  areas: [{ id: "range", kind: "range", label: "Driving range", outdoor: true }],
  hours: "24/7",
  hours_note: "",
  website: "",
  status: "pending",
  admin_note: null,
  created_at: "2026-11-28T18:00:00Z",
  decided_at: null,
  ...r,
});

describe("added places", () => {
  it("become places, private until approved", () => {
    const p = toPlace(row(), true);
    expect(p).toMatchObject({ id: "added-ab12cd34ef", name: "Lakeshore Range", seasons: [], added: { status: "pending", mine: true } });
    expect(isPrivate(p)).toBe(true);
    expect(isPrivate(toPlace(row({ status: "approved" }), false))).toBe(false);
    expect(isPrivate(toPlace(row({ status: "rejected", admin_note: "Closed for good" }), true))).toBe(true);
  });

  it("say where the hours came from", () => {
    expect(toPlace(row(), true).hoursNote).toBe("Hours from the golfer who added it.");
    expect(toPlace(row({ hours_note: "Shorter in winter" }), true).hoursNote).toBe("From the golfer who added it: Shorter in winter");
  });

  it("only take ids the database makes", () => {
    expect(isAddedId("added-ab12cd34ef")).toBe(true);
    expect(isAddedId("harborside")).toBe(false);
    expect(isAddedId("added-../x")).toBe(false);
  });

  it("send the picked areas in the app's order, indoor or outdoor together", () => {
    expect(requestAreas("walk_in", ["putting", "range"], false)).toEqual([
      { id: "range", kind: "range", label: "Driving range", outdoor: true },
      { id: "putting", kind: "putting", label: "Putting green", outdoor: true },
    ]);
    expect(requestAreas("walk_in", ["bays"], true)[0].outdoor).toBe(false);
    expect(requestAreas("sim", ["range"], false)).toEqual([{ id: "bays", kind: "bays", label: "Simulator bays", outdoor: false }]);
  });

  it("send 24/7 or the same hours every day", () => {
    expect(requestHours(true, "08:00", "21:00")).toBe("24/7");
    expect(requestHours(false, "08:00", "21:00")).toEqual([{ days: [0, 1, 2, 3, 4, 5, 6], open: "08:00", close: "21:00" }]);
  });
});
