import { describe, expect, it } from "vitest";
import { activeKey, GROQ_KEY_EXPIRES } from "./ai-key";

describe("activeKey", () => {
  const before = new Date(GROQ_KEY_EXPIRES.getTime() - 1);

  it("returns the key until it expires", () => {
    expect(activeKey("gsk_test", before)).toBe("gsk_test");
    expect(activeKey("  gsk_test \n", before)).toBe("gsk_test");
  });

  it("treats the key as missing from the expiry moment on", () => {
    expect(activeKey("gsk_test", GROQ_KEY_EXPIRES)).toBeNull();
    expect(activeKey("gsk_test", new Date("2027-01-01T00:00:00Z"))).toBeNull();
  });

  it("treats an empty or missing key as missing", () => {
    expect(activeKey(undefined, before)).toBeNull();
    expect(activeKey("", before)).toBeNull();
    expect(activeKey("   ", before)).toBeNull();
  });

  it("expires 30 days after the key was added, at midnight in Chicago", () => {
    expect(GROQ_KEY_EXPIRES.toISOString()).toBe("2026-12-17T06:00:00.000Z");
    const added = new Date("2026-11-17T00:00:00-06:00");
    expect((GROQ_KEY_EXPIRES.getTime() - added.getTime()) / 86400_000).toBe(30);
  });
});
