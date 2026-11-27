"use client";

import { useMemo, useRef, useState } from "react";
import { Alert, Button, cx } from "@/components/ui";
import { chicagoParts, weekdayLabel } from "@/lib/chicago-time";
import { useDb } from "@/lib/db";
import { suggestionsFor, type SuggestedRule, type Suggestion } from "@/lib/suggestions";
import type { HoursRule, Place, Report } from "@/lib/types";

// The admin panel on a place page (admins only; every action is checked again
// in the database). Suggestions from golfers' reports come first, then what's
// confirmed now, then forms to confirm a status or change the hours.

const DISMISSED_KEY = "range-report:dismissed-suggestions";
const readDismissed = (): string[] => {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

const input = "h-10 rounded-md border-2 border-edge bg-surface px-3 text-body";
const label = "flex flex-col gap-1 text-label font-semibold text-muted";

type Day = { open: boolean; from: string; to: string };

function daysFrom(hours: Place["hours"]): Day[] {
  return Array.from({ length: 7 }, (_, d) => {
    if (hours === "24/7") return { open: true, from: "00:00", to: "00:00" };
    const rule = hours.find((h) => h.days.includes(d));
    return rule ? { open: true, from: rule.open, to: rule.close } : { open: false, from: "09:00", to: "17:00" };
  });
}

// Days with the same times share one rule, like the hours in places.ts.
function rulesFrom(days: Day[]): HoursRule[] {
  const out: HoursRule[] = [];
  days.forEach((d, i) => {
    if (!d.open) return;
    const same = out.find((r) => r.open === d.from && r.close === d.to);
    if (same) same.days.push(i);
    else out.push({ days: [i], open: d.from, close: d.to });
  });
  return out;
}

export function AdminPanel({
  place,
  reports,
  now,
  onChanged,
}: {
  place: Place; // with confirmed statuses and admin hours merged in
  reports: Report[]; // the reports that count, from everyone
  now: Date;
  onChanged: () => void;
}) {
  const { db } = useDb();
  const today = chicagoParts(now).dateKey;
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === "undefined" ? [] : readDismissed()));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => suggestionsFor(place, reports, now).filter((s) => !dismissed.includes(s.key)), [place, reports, now, dismissed]);
  const confirmed = (place.confirmed ?? []).filter((c) => !c.endsOn || c.endsOn >= today);
  const areaLabel = (id: string | null) => (id === null ? "Whole place" : (place.areas.find((a) => a.id === id)?.label ?? id));

  // Confirm-a-status form.
  const [rule, setRule] = useState<SuggestedRule>({ areaId: place.areas[0]?.id ?? null, condition: "limited", note: "" });
  const [starts, setStarts] = useState(today);
  const [ends, setEnds] = useState("");

  // Hours form.
  const [days, setDays] = useState<Day[]>(() => daysFrom(place.hours));
  const [hoursNote, setHoursNote] = useState("");

  async function run(what: string, call: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true);
    setError(null);
    setDone(null);
    const { error } = await call();
    setBusy(false);
    if (error) {
      setError(`Couldn't ${what}: ${error.message}`);
      return false;
    }
    setDone(`Done: ${what}.`);
    onChanged();
    return true;
  }

  const confirmRule = (r: SuggestedRule, from = today, to: string | null = null) =>
    run("confirm the status", () =>
      db.rpc("admin_set_rule", { p_place_id: place.id, p_area_id: r.areaId ?? "", p_condition: r.condition, p_note: r.note, p_starts_on: from, p_ends_on: to }),
    );
  const endRule = (id: string) => run("end the confirmed status", () => db.rpc("admin_end_rule", { p_rule_id: id }));
  const dismiss = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next);
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  };

  // "Edit first" / "Fill in the hours" open the update box and go to its form.
  const updateBox = useRef<HTMLDetailsElement>(null);
  const goTo = (id: string) => {
    if (updateBox.current) updateBox.current.open = true;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  const apply = (s: Suggestion) => {
    if (s.kind === "review") return endRule(s.ruleId);
    if (s.kind === "hours") {
      // Fill in the hours form with the closing time golfers mention, for the admin to check.
      setDays((ds) => ds.map((d) => (d.open ? { ...d, to: s.closesAt } : d)));
      setHoursNote(`Golfers report it closes at ${s.closesAt}`);
      goTo("admin-hours");
      return;
    }
    return confirmRule(s.rule);
  };

  const editFirst = (s: Suggestion) => {
    if (s.kind !== "agree" && s.kind !== "season") return;
    setRule(s.rule);
    goTo("admin-rule");
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error" title={error} onDismiss={() => setError(null)} />}
      {done && <p className="text-label font-semibold text-open" role="status">{done}</p>}

      {/* Box 1: what golfers' reports suggest changing. */}
      <details className="group rounded-xl border-2 border-dashed border-brass bg-cream/50">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="rounded-full bg-brass px-2.5 py-0.5 text-label font-semibold text-on-green">Admin</span>
        <span className="text-heading">Suggestions</span>
        {suggestions.length > 0 && (
          <span className="rounded-full border border-limited bg-limited-tint px-2.5 py-0.5 text-label font-semibold text-limited">
            {suggestions.length}
          </span>
        )}
        <svg viewBox="0 0 16 16" className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6 L8 10 L12 6" />
        </svg>
      </summary>
        <div className="flex flex-col gap-3 border-t border-brass/40 px-5 py-5">
        {/* 1. Suggestions */}
        <section className="flex flex-col gap-3" aria-labelledby="admin-suggestions">
          <h3 id="admin-suggestions" className="sr-only">Suggested from golfers&apos; reports</h3>
          <p className="text-label font-normal text-muted">From golfers&apos; reports at this place. Nothing changes until you confirm.</p>
          {suggestions.length === 0 ? (
            <p className="text-body text-muted">Nothing to suggest: what golfers report matches what this place shows.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {suggestions.map((s) => (
                <li key={s.key} className="flex flex-col gap-2 rounded-lg border border-rule bg-surface p-4">
                  <p className="font-semibold text-ink">{s.title}</p>
                  <p className="text-label font-normal text-muted">{s.detail}</p>
                  {(s.kind === "agree" || s.kind === "season") && (
                    <p className="text-label text-ink">Would confirm: {areaLabel(s.rule.areaId)}, {s.rule.condition}, &ldquo;{s.rule.note}&rdquo;</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={busy} onClick={() => apply(s)}>
                      {s.kind === "review" ? "End it" : s.kind === "hours" ? "Fill in the hours" : "Confirm"}
                    </Button>
                    {(s.kind === "agree" || s.kind === "season") && (
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => editFirst(s)}>Edit first</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => dismiss(s.key)}>Dismiss</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        </div>
      </details>

      {/* Box 2: what's confirmed now, and the forms to change it. */}
      <details ref={updateBox} className="group rounded-xl border-2 border-dashed border-brass bg-cream/50">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="rounded-full bg-brass px-2.5 py-0.5 text-label font-semibold text-on-green">Admin</span>
        <span className="text-heading">Update this place</span>
        <svg viewBox="0 0 16 16" className="ml-auto size-5 text-muted transition-transform group-open:rotate-180" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6 L8 10 L12 6" />
        </svg>
      </summary>
        <div className="flex flex-col gap-6 border-t border-brass/40 px-5 py-5">
        {/* 2. Confirmed now */}
        <section className="flex flex-col gap-3" aria-labelledby="admin-confirmed">
          <h3 id="admin-confirmed" className="text-body font-semibold">Confirmed statuses</h3>
          {confirmed.length === 0 ? (
            <p className="text-body text-muted">None. This place shows golfers&apos; reports, then its published hours and seasons.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {confirmed.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule bg-surface px-4 py-3">
                  <span className="text-body">
                    <span className="font-semibold">{areaLabel(c.areaId)}: {c.condition}</span> · {c.note}
                    <span className="block text-label font-normal text-muted">
                      From {c.startsOn}
                      {c.endsOn ? ` to ${c.endsOn}` : ", until ended"}
                    </span>
                  </span>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => endRule(c.id)}>End</Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 3. Confirm a status */}
        <form
          id="admin-rule"
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!rule.note.trim()) return setError("Add a short note saying what golfers found.");
            if (await confirmRule(rule, starts, ends || null)) setRule((r) => ({ ...r, note: "" }));
          }}
        >
          <h3 className="text-body font-semibold">Confirm a status</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className={label}>
              Area
              <select className={input} value={rule.areaId ?? ""} onChange={(e) => setRule({ ...rule, areaId: e.target.value || null })}>
                <option value="">Whole place</option>
                {place.areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
            </label>
            <label className={label}>
              Status
              <select className={input} value={rule.condition} onChange={(e) => setRule({ ...rule, condition: e.target.value as SuggestedRule["condition"] })}>
                <option value="open">Open / good</option>
                <option value="limited">Limited</option>
                <option value="closed">Closed</option>
              </select>
            </label>
            <label className={label}>
              From
              <input type="date" className={input} value={starts} onChange={(e) => setStarts(e.target.value)} />
            </label>
            <label className={cx(label, "sm:col-span-2")}>
              Note (shown to golfers)
              <input className={input} maxLength={200} value={rule.note} placeholder="Mats only, through the winter" onChange={(e) => setRule({ ...rule, note: e.target.value })} />
            </label>
            <label className={label}>
              Until (optional)
              <input type="date" className={input} value={ends} min={starts} onChange={(e) => setEnds(e.target.value)} />
            </label>
          </div>
          <Button type="submit" size="sm" disabled={busy} className="w-fit">Confirm status</Button>
        </form>

        {/* 4. Hours */}
        <form
          id="admin-hours"
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const hours = rulesFrom(days);
            if (!hours.length) return setError("Mark at least one day open (or use Back to published hours).");
            await run("save the hours", () => db.rpc("admin_set_hours", { p_place_id: place.id, p_hours: hours, p_note: hoursNote }));
          }}
        >
          <h3 className="text-body font-semibold">Hours{place.hoursUpdated ? " (updated by an admin)" : " (published)"}</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {days.map((d, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-md border border-rule bg-surface p-2">
                <label className="flex items-center gap-2 text-label font-semibold">
                  <input type="checkbox" checked={d.open} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, open: e.target.checked } : x)))} />
                  {weekdayLabel(i)} {d.open ? "" : "· closed"}
                </label>
                {d.open && (
                  <div className="flex items-center gap-1">
                    <input type="time" aria-label={`${weekdayLabel(i)} opens`} className={cx(input, "h-9 px-2")} value={d.from} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
                    <span className="text-muted">–</span>
                    <input type="time" aria-label={`${weekdayLabel(i)} closes`} className={cx(input, "h-9 px-2")} value={d.to} onChange={(e) => setDays(days.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <label className={label}>
            Note (shown with the hours)
            <input className={input} maxLength={300} value={hoursNote} placeholder="Winter hours, confirmed by golfers" onChange={(e) => setHoursNote(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={busy}>Save hours</Button>
            {place.hoursUpdated && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => run("go back to the published hours", () => db.rpc("admin_clear_hours", { p_place_id: place.id }))}>
                Back to published hours
              </Button>
            )}
          </div>
        </form>
        </div>
      </details>
    </div>
  );
}
