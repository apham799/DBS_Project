import { describe, expect, it } from "vitest";
import { bySource } from "./report-source";
import { placeStatus } from "./status";
import type { Place, Report } from "./types";

const range: Place = {
  id: "p",
  name: "P",
  kind: "walk_in",
  neighborhood: "",
  address: "",
  lat: 0,
  lon: 0,
  website: "",
  areas: [{ id: "range", kind: "range", label: "Range", outdoor: true }],
  hours: "24/7",
  hoursNote: "",
  seasons: [],
};
const NOW = new Date("2026-11-14T20:00:00Z");
const at = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();
const account: Report = { id: "a", placeId: "p", createdAt: at(3), placeOpen: true, areas: { range: "good" }, crowd: null, source: "account" };
const old: Report = { id: "o", placeId: "p", createdAt: at(5), placeOpen: true, areas: { range: "good" }, crowd: null }; // before guest posting: no source
const guest: Report = { id: "g", placeId: "p", createdAt: at(1), placeOpen: true, areas: { range: "closed" }, crowd: null, source: "guest" };
const all = [guest, account, old];

describe("bySource", () => {
  it("keeps everyone, only accounts (including reports with no source), or only guests", () => {
    expect(bySource(all, "everyone").map((r) => r.id)).toEqual(["g", "a", "o"]);
    expect(bySource(all, "accounts").map((r) => r.id)).toEqual(["a", "o"]);
    expect(bySource(all, "guests").map((r) => r.id)).toEqual(["g"]);
  });

  it("changes what the status says, since status is computed from the filtered list", () => {
    const area = (s: ReturnType<typeof placeStatus>) => s.areas[0];
    // Newest is a guest saying closed.
    expect(area(placeStatus(range, bySource(all, "everyone"), NOW))).toMatchObject({ state: "closed", basis: "report" });
    // Without guests, the account reports say good.
    expect(area(placeStatus(range, bySource(all, "accounts"), NOW))).toMatchObject({ state: "open", basis: "report" });
  });
});
