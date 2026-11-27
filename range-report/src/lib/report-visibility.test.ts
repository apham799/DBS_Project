import { describe, expect, it } from "vitest";
import { counts, hiddenLabel, hiddenWhy } from "./report-visibility";
import type { Report } from "./types";

const r = (f: Partial<Report> = {}): Report => ({ id: "r", placeId: "p", createdAt: "", placeOpen: true, areas: {}, crowd: null, ...f });

describe("report visibility", () => {
  it("counts reports unless an admin hid them or they're voted down by 2+ more than up", () => {
    expect(counts(r())).toBe(true);
    expect(counts(r({ upVotes: 3, downVotes: 4 }))).toBe(true); // down by 1
    expect(counts(r({ upVotes: 1, downVotes: 3 }))).toBe(false); // down by 2
    expect(counts(r({ hiddenAt: "2026-11-28T00:00:00Z", upVotes: 9 }))).toBe(false); // admin wins
  });

  it("says why a report is hidden", () => {
    expect(hiddenLabel(hiddenWhy(r({ hiddenAt: "x", hiddenReason: "Spam" }))!)).toBe("Hidden by an admin: Spam");
    expect(hiddenLabel(hiddenWhy(r({ hiddenAt: "x" }))!)).toBe("Hidden by an admin");
    expect(hiddenLabel(hiddenWhy(r({ downVotes: 2 }))!)).toBe("Hidden: voted down by 2 golfers");
    expect(hiddenLabel(hiddenWhy(r({ downVotes: 3, upVotes: 1 }))!)).toBe("Hidden: voted down by 3 golfers, up by 1");
  });
});
