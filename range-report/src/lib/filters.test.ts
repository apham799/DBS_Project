import { describe, expect, it } from "vitest";
import { places } from "../data/places";
import { featuresOf, matches, NO_FILTERS, settingOf, type Filters } from "./filters";
import type { PlaceStatus } from "./status";

const byId = (id: string) => places.find((p) => p.id === id)!;
const status = (open: boolean): PlaceStatus => ({
  hours: { open, closingSoon: false, label: "" },
  areas: [],
  crowd: null,
  lastReportAt: null,
  reportsThisWeek: 0,
});
const names = (f: Partial<Filters>, open = true) =>
  places.filter((p) => matches(p, status(open), { ...NO_FILTERS, ...f })).map((p) => p.id);

describe("features and setting come from a place's areas", () => {
  it("knows each kind of place", () => {
    expect([...featuresOf(byId("harborside"))].sort()).toEqual(["putting", "range", "short_game"]);
    expect([...featuresOf(byId("cog-hill"))].sort()).toEqual(["heated", "putting", "range", "short_game"]);
    expect([...featuresOf(byId("mistwood-golf-dome"))].sort()).toEqual(["heated", "putting", "range", "short_game"]);
    expect([...featuresOf(byId("five-iron-bucktown"))]).toEqual(["sims"]);
    expect([...featuresOf(byId("parennial-lincoln-park"))].sort()).toEqual(["putting", "sims"]);
  });

  it("calls simulator places and the dome indoor, ranges outdoor", () => {
    expect(settingOf(byId("mistwood-golf-dome"))).toBe("indoor");
    expect(settingOf(byId("pga-superstore-lincoln-park"))).toBe("indoor");
    expect(settingOf(byId("diversey"))).toBe("outdoor"); // heated stalls still hit outside
    expect(settingOf(byId("golf-center-des-plaines"))).toBe("outdoor");
  });
});

describe("matches", () => {
  it("shows everything with no filters", () => {
    expect(names({})).toHaveLength(places.length);
  });

  it("needs every feature asked for", () => {
    expect(names({ features: ["range", "short_game"] })).toEqual(["harborside", "jackson-park", "cog-hill", "golf-center-des-plaines", "mistwood-golf-dome"]);
    expect(names({ features: ["sims"] })).toEqual(["pga-superstore-lincoln-park", "five-iron-bucktown", "parennial-lincoln-park"]);
    expect(names({ features: ["range", "sims"] })).toEqual([]);
  });

  it("filters by setting and by open now", () => {
    expect(names({ setting: "indoor", features: ["range"] })).toEqual(["mistwood-golf-dome"]);
    expect(names({ openNow: true }, false)).toEqual([]);
    expect(names({ openNow: true }, true)).toHaveLength(places.length);
  });
});
