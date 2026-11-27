"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { POSTED_KEY } from "@/components/place-view";
import { StateIcon } from "@/components/status";
import { Alert, Button, ButtonLink, Card, cx, Spinner, TextLink } from "@/components/ui";
import { placeById } from "@/data/places";
import { useDb } from "@/lib/db";
import type { Condition, Crowd } from "@/lib/types";

// Public notes: short, and no links (the database checks both too).
const PUBLIC_MAX = 280;
// Same rule as the database: http(s)://, www., or a bare domain (example.com).
const hasLink = (s: string) =>
  /(https?:\/\/|www\.)/i.test(s) || /[a-z0-9-]+\.(com|net|org|io|co|ly|gg|me|xyz|info|biz|app|dev|link|site|shop|club|us|tv|to)(\b|\/)/i.test(s);

// Three taps, then your own notes. Posting has to beat texting a friend, so
// only the first question is required; everything else can be skipped.

type Changed = "time" | "place" | "plan" | "packed" | "no";

const conditions: { value: Condition; label: string; state: "open" | "limited" | "closed" }[] = [
  { value: "good", label: "Good", state: "open" },
  { value: "limited", label: "Limited", state: "limited" },
  { value: "closed", label: "Closed", state: "closed" },
];
const crowds: { value: Crowd; label: string }[] = [
  { value: "quiet", label: "Walk right in" },
  { value: "some_wait", label: "Short wait" },
  { value: "busy", label: "Packed" },
];
const changes: { value: Changed; label: string }[] = [
  { value: "time", label: "I went at a different time" },
  { value: "place", label: "I went somewhere else" },
  { value: "plan", label: "I changed what I practiced" },
  { value: "packed", label: "I packed differently" },
  { value: "no", label: "No" },
];

const selectedTone = {
  open: "border-open bg-open-tint text-open",
  limited: "border-limited bg-limited-tint text-limited",
  closed: "border-closed bg-closed-tint text-closed",
  neutral: "border-green bg-green text-on-green",
};

// A row of choices that behaves like radio buttons, but can be tapped again to clear.
function Choice<T extends string>({
  legend,
  hint,
  options,
  value,
  onChange,
  tone,
  icon,
}: {
  legend: ReactNode;
  hint?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  tone?: (v: T) => keyof typeof selectedTone;
  icon?: (v: T) => ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-body font-semibold">
        {legend}
        {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : o.value)}
              className={cx(
                "inline-flex h-12 items-center gap-2 rounded-md border-2 px-4 text-body font-semibold transition-colors",
                on ? selectedTone[tone ? tone(o.value) : "neutral"] : "border-edge bg-surface text-ink hover:bg-cream",
              )}
            >
              {icon?.(o.value)}
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ReportForm({ placeId }: { placeId: string }) {
  const place = placeById(placeId)!;
  const router = useRouter();
  const { db, isLoaded, userId } = useDb();
  // Signed out, they choose: sign in (and keep a private log) or post as a guest.
  const [asGuest, setAsGuest] = useState(false);
  const guest = !userId;
  const [open, setOpen] = useState<"yes" | "no" | null>(null);
  const [areas, setAreas] = useState<Record<string, Condition>>({});
  const [crowd, setCrowd] = useState<Crowd | null>(null);
  const [publicNote, setPublicNote] = useState("");
  const [note, setNote] = useState("");
  const [changed, setChanged] = useState<Changed | null>(null);
  // One id per visit to the form: if the response to a post is lost and they
  // tap Post again, the database recognises the id and doesn't post twice.
  const [reportId] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!open || hasLink(publicNote)) return;
    setSaving(true);
    setError(null);
    const shared = {
      p_place_id: place.id,
      p_place_open: open === "yes",
      p_areas: open === "yes" ? areas : {},
      p_crowd: open === "yes" ? crowd : null,
      p_public_note: publicNote,
      p_id: reportId,
    };
    // Signed in: the report and its private log entry. Guest: the report only,
    // marked as a guest report (limits are per device; see the migration).
    const { error } = guest
      ? await db.rpc("post_guest_report", shared)
      : await db.rpc("post_report", { ...shared, p_note: note, p_changed_decision: changed });
    setSaving(false);
    if (error) {
      // RR429: the database's rate limit (one report per place every 10 minutes).
      setError(
        error.code === "RR429"
          ? "You posted here in the last few minutes, so this one wasn't added. You can post again about 10 minutes after your last report."
          : error.code === "RR430"
            ? "There have been a lot of guest reports here in the last hour, so guest posting is paused for a bit. Sign in to post now."
            : "Your report didn't save. Check your connection and try again. Nothing you entered was lost.",
      );
      return;
    }
    sessionStorage.setItem(POSTED_KEY, place.id);
    router.push(`/places/${place.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <TextLink href={`/places/${place.id}`} className="w-fit">← {place.name}</TextLink>
      <div className="flex flex-col gap-1">
        <h1 className="text-display">How was {place.name}?</h1>
        <p className="text-body text-muted">Only the first question is needed. Your report is shared without your name.</p>
      </div>

      {/* Signed out: a choice first. Signing in is offered, never required. */}
      {isLoaded && guest && !asGuest && (
        <Card tone="cream" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-heading">Sign in to keep this in your log</h2>
            <p className="text-body text-muted">
              With an account, every report you post goes into your own private practice log (what you worked on, and whether a report changed your plans), and you
              can follow your places. Your report is shared without your name either way.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href={`/sign-up?redirect_url=${encodeURIComponent(`/places/${place.id}/report`)}`}>Sign up</ButtonLink>
            <ButtonLink href={`/sign-in?redirect_url=${encodeURIComponent(`/places/${place.id}/report`)}`} variant="secondary">Sign in</ButtonLink>
            <span className="text-body text-muted">or</span>
            <Button variant="ghost" onClick={() => setAsGuest(true)}>Post as a guest</Button>
          </div>
        </Card>
      )}

      {isLoaded && (!guest || asGuest) && (
        <form onSubmit={submit} className="flex flex-col gap-8" noValidate>
          <Card as="section" className="flex flex-col gap-6" labelledBy="shared">
            <h2 id="shared" className="text-heading">Shared with everyone</h2>

            <div className="flex flex-col gap-2">
              <Choice
                legend={place.kind === "sim" ? "Could you get in and play?" : "Was it open?"}
                options={[{ value: "yes", label: "Yes, it was open" }, { value: "no", label: "No, it was closed" }]}
                value={open}
                onChange={setOpen}
              />
              {tried && !open && (
                <p className="text-label text-error" role="alert">Choose whether it was open, so we know what to show.</p>
              )}
            </div>

            {open === "yes" && (
              <>
                <div className="flex flex-col gap-5">
                  <p className="text-body font-semibold">
                    How were the areas you used? <span className="font-normal text-muted">Skip any you didn&apos;t see.</span>
                  </p>
                  {place.areas.map((a) => (
                    <Choice
                      key={a.id}
                      legend={<span className="font-normal">{a.label}</span>}
                      options={conditions}
                      value={areas[a.id] ?? null}
                      onChange={(v) =>
                        setAreas((s) => {
                          const next = { ...s };
                          if (v) next[a.id] = v;
                          else delete next[a.id];
                          return next;
                        })
                      }
                      tone={(v) => conditions.find((c) => c.value === v)!.state}
                      icon={(v) => <StateIcon state={conditions.find((c) => c.value === v)!.state} />}
                    />
                  ))}
                  <p className="text-label font-normal text-muted">Limited means usable but not normal: mats only, part closed, poorly kept.</p>
                </div>
                <Choice legend="How busy was it?" hint="Optional" options={crowds} value={crowd} onChange={setCrowd} />
              </>
            )}

            {open && (
              <label className="flex flex-col gap-2">
                <span className="text-body font-semibold">
                  Anything other golfers should know? <span className="font-normal text-muted">Optional</span>
                </span>
                <textarea
                  value={publicNote}
                  onChange={(e) => setPublicNote(e.target.value.slice(0, PUBLIC_MAX))}
                  rows={2}
                  maxLength={PUBLIC_MAX}
                  aria-describedby="public-note-help"
                  aria-invalid={hasLink(publicNote) || undefined}
                  placeholder={open === "yes" ? "Chipping green roped off, use the side putting green. Mats only on the range." : "Closed for a private event until 3."}
                  className="rounded-md border-2 border-edge bg-surface p-3 text-body"
                />
                <span id="public-note-help" className="flex justify-between gap-3 text-label font-normal text-muted">
                  <span>Everyone sees this with your report, without your name. No links.</span>
                  <span aria-live="polite">{publicNote.length}/{PUBLIC_MAX}</span>
                </span>
                {hasLink(publicNote) && (
                  <span className="text-label text-error" role="alert">Take out the link to post. Notes can&apos;t include links.</span>
                )}
              </label>
            )}
          </Card>

          {guest ? (
            <Card as="section" tone="cream" className="flex flex-col gap-2" labelledBy="private">
              <h2 id="private" className="text-heading">Posting as a guest</h2>
              <p className="text-body text-muted">
                Your report shows as a guest report. To keep a private log of your sessions,{" "}
                <TextLink href={`/sign-in?redirect_url=${encodeURIComponent(`/places/${place.id}/report`)}`}>sign in</TextLink> first.
              </p>
            </Card>
          ) : (
          <Card as="section" tone="cream" className="flex flex-col gap-6" labelledBy="private">
            <div className="flex flex-col gap-1">
              <h2 id="private" className="text-heading">Just for you</h2>
              <p className="text-label font-normal text-muted">Only you can see this.</p>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-body font-semibold">
                What did you work on? <span className="font-normal text-muted">Optional</span>
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Wedges felt inconsistent, only hit ten drivers…"
                className="rounded-md border-2 border-edge bg-surface p-3 text-body"
              />
            </label>
            <Choice legend="Did Range Report change anything about this trip?" hint="Optional" options={changes} value={changed} onChange={setChanged} />
          </Card>
          )}

          {error && <Alert tone="error" title={error} />}

          <Button type="submit" size="lg" disabled={saving} className="sm:w-fit">
            {saving && <Spinner />}
            {saving ? "Posting…" : "Post report"}
          </Button>
        </form>
      )}
    </div>
  );
}
