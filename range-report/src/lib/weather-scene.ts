// What the landing banner's scene should look like for the weather right now:
// day or night, the conditions (from the WMO weather code) and whether it's
// windy. Pure, so it's tested on its own.

export type SceneCondition = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";
export type Scene = { night: boolean; condition: SceneCondition; windy: boolean };

// Wind at or above this reads as windy: flags fly, rain slants.
export const WINDY_MPH = 15;

export const CALM_DAY: Scene = { night: false, condition: "clear", windy: false };

export function conditionOf(code: number): SceneCondition {
  if (code === 0) return "clear";
  if (code <= 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

export function sceneFor(w: { code: number; windMph: number; isDay?: boolean } | undefined): Scene {
  if (!w) return CALM_DAY;
  return { night: w.isDay === false, condition: conditionOf(w.code), windy: w.windMph >= WINDY_MPH };
}

// "41°F, rain, wind 23 mph": the scene in words, for the caption.
export function sceneCaption(w: { tempF: number; label: string; windMph: number }): string {
  return `${w.tempF}°F, ${w.label.toLowerCase()}, wind ${w.windMph} mph`;
}
