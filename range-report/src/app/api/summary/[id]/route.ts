import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { placeById } from "@/data/places";
import { aiSummary, aiSummaryEnabled, MAX_REPORTS, MIN_NOTES, reportsBlock } from "@/lib/ai-summary-server";
import { SUMMARY_DAYS } from "@/lib/summary";
import type { Report } from "@/lib/types";

// GET /api/summary/:placeId → Claude's short summary of the last 30 days of
// reports at one place. Reads reports as a guest would (publishable key, the
// anon role): reports are public, so the server sees nothing a guest couldn't.
//
//   { status: "ok", text, reports, notes }
//   { status: "few_notes", notes }   not enough written notes to summarize yet
//   { status: "off" }                no ANTHROPIC_API_KEY configured
//   { status: "error" } (502)        Supabase or Claude failed; try again later

export type AiSummaryResponse =
  | { status: "ok"; text: string; reports: number; notes: number }
  | { status: "few_notes"; notes: number }
  | { status: "off" }
  | { status: "error" };

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: AiSummaryResponse, status = 200) => Response.json(body, { status });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/summary/[id]">) {
  const { id } = await ctx.params;
  const place = placeById(id);
  if (!place) return Response.json({ error: "Unknown place" }, { status: 404 });
  if (!aiSummaryEnabled()) return json({ status: "off" });

  const since = new Date(Date.now() - SUMMARY_DAYS * 86400_000).toISOString();
  const { data, error } = await db
    .from("reports")
    .select("id, place_id, created_at, place_open, areas, crowd, note")
    .eq("place_id", place.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_REPORTS);
  if (error) return json({ status: "error" }, 502);

  const reports: Report[] = data.map((r) => ({
    id: r.id,
    placeId: r.place_id,
    createdAt: r.created_at,
    placeOpen: r.place_open,
    areas: r.areas ?? {},
    crowd: r.crowd,
    note: r.note,
  }));
  const notes = reports.filter((r) => r.note).length;
  if (notes < MIN_NOTES) return json({ status: "few_notes", notes });

  try {
    const text = await aiSummary(place.name, reportsBlock(place, reports));
    return text ? json({ status: "ok", text, reports: reports.length, notes }) : json({ status: "error" }, 502);
  } catch (e) {
    console.error("AI summary failed:", e instanceof Error ? e.message : e);
    return json({ status: "error" }, 502);
  }
}
