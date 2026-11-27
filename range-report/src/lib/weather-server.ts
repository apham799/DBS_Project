import "server-only";

import { cacheLife } from "next/cache";
import { places } from "@/data/places";

// Current weather at every place, in ONE batched Open-Meteo call, on the server.
// Cached for 15 minutes so every golfer shares the same call (the free tier
// allows about 10,000 a day; this uses at most ~100). A thrown error is never
// cached, so a failed call is retried on the next request.
//
// v1 fetches on demand like A4; the A5-style Cron worker comes in week 2.

export type PlaceWeather = {
  tempF: number;
  feelsLikeF: number;
  windMph: number;
  precipIn: number;
  code: number;
  label: string;
  stormNow: boolean;
  isDay: boolean; // for the landing banner's day/night scene
};

// WMO weather codes, grouped the way a golfer cares about them.
export function weatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Snow";
  if (code >= 95) return "Thunderstorm";
  return "Mixed";
}

export async function fetchWeather(): Promise<Record<string, PlaceWeather>> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: places.map((p) => p.lat).join(","),
    longitude: places.map((p) => p.lon).join(","),
    current: "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "America/Chicago",
  }).toString();

  const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  const body = await res.json();
  // One location returns an object; several return an array in request order.
  const list = Array.isArray(body) ? body : [body];
  if (list.length !== places.length) throw new Error("Open-Meteo returned the wrong number of locations");

  const out: Record<string, PlaceWeather> = {};
  places.forEach((p, i) => {
    const c = list[i]?.current;
    if (typeof c?.temperature_2m !== "number") return;
    out[p.id] = {
      tempF: Math.round(c.temperature_2m),
      feelsLikeF: Math.round(c.apparent_temperature),
      windMph: Math.round(c.wind_speed_10m),
      precipIn: c.precipitation ?? 0,
      code: c.weather_code,
      label: weatherLabel(c.weather_code),
      stormNow: c.weather_code >= 95,
      isDay: c.is_day !== 0,
    };
  });
  return out;
}
