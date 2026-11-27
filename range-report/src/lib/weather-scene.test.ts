import { describe, expect, it } from "vitest";
import { CALM_DAY, conditionOf, sceneCaption, sceneFor, WINDY_MPH } from "./weather-scene";

describe("weather scene", () => {
  it("maps WMO codes to conditions", () => {
    expect([0, 1, 3, 45, 53, 61, 81, 73, 95].map(conditionOf)).toEqual(["clear", "partly", "cloudy", "fog", "drizzle", "rain", "rain", "snow", "storm"]);
  });

  it("knows night and wind", () => {
    // Tonight in Chicago: rain, 23 mph wind, dark.
    expect(sceneFor({ code: 61, windMph: 23, isDay: false })).toEqual({ night: true, condition: "rain", windy: true });
    expect(sceneFor({ code: 0, windMph: WINDY_MPH - 1, isDay: true })).toEqual({ night: false, condition: "clear", windy: false });
    expect(sceneFor({ code: 3, windMph: WINDY_MPH, isDay: true }).windy).toBe(true);
  });

  it("falls back to a calm day without weather, and says it in words", () => {
    expect(sceneFor(undefined)).toEqual(CALM_DAY);
    expect(sceneCaption({ tempF: 41, label: "Rain", windMph: 23 })).toBe("41°F, rain, wind 23 mph");
  });
});
