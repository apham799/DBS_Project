import { fetchWeather } from "@/lib/weather-server";

// GET /api/weather → current weather at every place, keyed by place id.
// The browser never calls Open-Meteo itself: one cached server call is shared.
export async function GET() {
  try {
    return Response.json(await fetchWeather());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Weather unavailable" }, { status: 502 });
  }
}
