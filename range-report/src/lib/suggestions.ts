import { chicagoParts, clockLabel, toMinutes } from "./chicago-time";
import type { Condition, ConfirmedRule, Place, Report } from "./types";

// Suggestions for admins: what golfers' reports say should change about a
// place's standing status or hours. The app only proposes; an admin decides.
// Pure, so each rule is tested on its own (suggestions.test.ts).
//
//   agree        golfers agree on an area and nothing confirms it yet
//   season       a published season golfers have contradicted
//   review       a confirmed status that recent reports disagree with
//   hours        notes mention a closing time that differs from the hours

export type SuggestedRule = { areaId: string | null; condition: ConfirmedRule["condition"]; note: string };

export type Suggestion =
  | { kind: "agree"; key: string; title: string; detail: string; reportIds: string[]; rule: SuggestedRule }
  | { kind: "season"; key: string; title: string; detail: string; reportIds: string[]; rule: SuggestedRule }
  | { kind: "review"; key: string; title: string; detail: string; reportIds: string[]; ruleId: string }
  | { kind: "hours"; key: string; title: string; detail: string; reportIds: string[]; closesAt: string };

const DAY = 86400_000;
const AGREE_DAYS = 14; // look back this far for agreement
const AGREE_MIN = 3; // at least this many ratings
const AGREE_SHARE = 0.75; // and at least this share agreeing
const REVIEW_DAYS = 7;
const REVIEW_MIN = 2; // this many recent ratings disagreeing with a confirmed status

const conditionWord: Record<Condition, string> = { good: "good", limited: "limited", closed: "closed" };
const asRule = (c: Condition): SuggestedRule["condition"] => (c === "good" ? "open" : c);

const dateOf = (iso: string) => chicagoParts(new Date(iso)).dateKey;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" });

function activeRuleFor(place: Place, areaId: string, today: string) {
  return (place.confirmed ?? []).find((c) => (c.areaId === null || c.areaId === areaId) && c.startsOn <= today && (!c.endsOn || today <= c.endsOn));
}

function activeSeasonFor(place: Place, areaId: string, today: string) {
  return place.seasons.find((s) => s.from <= today && (!s.to || today <= s.to) && (!s.areas || s.areas.includes(areaId)));
}

// "they close by 3:30", "closes at 4 pm", "closing around 5:15" → minutes since
// midnight. A bare hour from 1 to 11 is read as PM (practice facilities don't
// close in the morning).
export function closingTimesIn(note: string): number[] {
  const out: number[] = [];
  const re = /\bclos(?:e|es|ed|ing)\s+(?:at|by|around|before)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/gi;
  for (const m of note.matchAll(re)) {
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const ap = m[3]?.toLowerCase().replace(/\./g, "");
    if (h < 1 || h > 12 || min > 59) continue;
    if (ap === "am") h = h === 12 ? 0 : h;
    else if (ap === "pm" || h <= 11) h = h === 12 ? 12 : h + 12;
    out.push(h * 60 + min);
  }
  return out;
}

export function suggestionsFor(place: Place, allReports: Report[], now: Date): Suggestion[] {
  const t = now.getTime();
  const today = chicagoParts(now).dateKey;
  const reports = allReports.filter((r) => r.placeId === place.id && new Date(r.createdAt).getTime() <= t).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const out: Suggestion[] = [];

  for (const area of place.areas) {
    const recent = reports.filter((r) => r.placeOpen && r.areas[area.id] && t - new Date(r.createdAt).getTime() < AGREE_DAYS * DAY);
    const rule = activeRuleFor(place, area.id, today);
    const season = activeSeasonFor(place, area.id, today);

    // agree / season: a clear majority, not already what's confirmed.
    if (recent.length >= AGREE_MIN) {
      const tally = new Map<Condition, Report[]>();
      for (const r of recent) tally.set(r.areas[area.id], [...(tally.get(r.areas[area.id]) ?? []), r]);
      const [top, backing] = [...tally.entries()].sort((a, b) => b[1].length - a[1].length)[0];
      const confirmedAlready = rule && rule.condition === asRule(top);
      if (backing.length / recent.length >= AGREE_SHARE && !confirmedAlready) {
        const since = shortDate(backing[backing.length - 1].createdAt);
        const suggested: SuggestedRule = { areaId: area.id, condition: asRule(top), note: `${area.label} ${conditionWord[top]}, as golfers have reported since ${since}` };
        const seasonDisagrees = season && season.condition !== asRule(top) && backing.some((r) => dateOf(r.createdAt) >= season.from);
        out.push(
          seasonDisagrees
            ? {
                kind: "season",
                key: `season:${area.id}:${top}`,
                title: `${area.label}: golfers say ${conditionWord[top]}, not "${season.note}"`,
                detail: `${backing.length} of ${recent.length} ratings in the last ${AGREE_DAYS} days say ${conditionWord[top]}, after the published season began. Confirming replaces it.`,
                reportIds: backing.map((r) => r.id),
                rule: suggested,
              }
            : {
                kind: "agree",
                key: `agree:${area.id}:${top}`,
                title: `Confirm ${area.label}: ${conditionWord[top]}?`,
                detail: `${backing.length} of ${recent.length} ratings in the last ${AGREE_DAYS} days say ${conditionWord[top]}.${rule ? ` It's confirmed as ${rule.condition} now.` : ""}`,
                reportIds: backing.map((r) => r.id),
                rule: suggested,
              },
        );
      }
    }

    // review: a confirmed status that recent reports disagree with.
    if (rule) {
      const against = reports.filter(
        (r) => r.placeOpen && r.areas[area.id] && asRule(r.areas[area.id]) !== rule.condition && t - new Date(r.createdAt).getTime() < REVIEW_DAYS * DAY && dateOf(r.createdAt) >= rule.startsOn,
      );
      if (against.length >= REVIEW_MIN && !out.some((s) => s.kind === "review" && s.ruleId === rule.id)) {
        out.push({
          kind: "review",
          key: `review:${rule.id}`,
          title: `Review "${rule.note}"`,
          detail: `${against.length} reports in the last ${REVIEW_DAYS} days say otherwise. End it, or confirm what they say.`,
          reportIds: against.map((r) => r.id),
          ruleId: rule.id,
        });
      }
    }
  }

  // hours: notes from the last 30 days mention a closing time that isn't
  // today's published one (taken from the most recent note that does).
  if (place.hours !== "24/7") {
    const { weekday } = chicagoParts(now);
    const todays = place.hours.find((h) => h.days.includes(weekday));
    const published = todays ? toMinutes(todays.close) : null;
    const noted = reports.filter((r) => r.note && t - new Date(r.createdAt).getTime() < 30 * DAY).flatMap((r) => closingTimesIn(r.note!).map((m) => ({ r, m })));
    const differing = published === null ? [] : noted.filter((x) => x.m !== published);
    if (differing.length) {
      const m = differing[0].m;
      const backing = differing.filter((x) => x.m === m).map((x) => x.r);
      out.push({
        kind: "hours",
        key: `hours:${m}`,
        title: `Check the hours: golfers mention closing at ${clockLabel(m)}`,
        detail: `${backing.length} note${backing.length === 1 ? "" : "s"} say${backing.length === 1 ? "s" : ""} it closes at ${clockLabel(m)}; today's hours say ${clockLabel(published!)}.`,
        reportIds: [...new Set(backing.map((r) => r.id))],
        closesAt: `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
      });
    }
  }

  return out;
}
