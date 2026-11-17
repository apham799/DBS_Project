import { connection } from "next/server";
import { fetchWeather } from "@/lib/weather-server";

// GET /api/weather → current weather at every place, keyed by place id.
// The browser never calls Open-Meteo itself: one cached server call is shared.
//
// connection() makes this run per request rather than being built into a
// static file at deploy time: a failed fetch then answers 502 for that one
// request (and is retried on the next), instead of possibly being stored as
// the response. fetchWeather's own cache (15 minutes) still means one
// Open-Meteo call is shared by everyone.
export async function GET() {
  await connection();
  try {
    return Response.json(await fetchWeather());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Weather unavailable" }, { status: 502 });
  }
}
