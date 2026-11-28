"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocationPicker, type LatLon } from "@/components/location-picker";
import { Alert, Button, ButtonLink, Card, cx, TextLink } from "@/components/ui";
import { AREA_CHOICES, requestAreas, requestHours } from "@/lib/added-places";
import { useDb } from "@/lib/db";
import { useAddedPlaces } from "@/lib/use-places";
import type { AreaKind } from "@/lib/types";

// Ask for a place that isn't on Range Report. It's usable right away, only by
// you, while an admin reviews it (the database keeps it private).

type Kind = "outdoor" | "dome" | "sim";
const KINDS: { id: Kind; label: string; detail: string }[] = [
  { id: "outdoor", label: "Driving range", detail: "Outdoors, maybe with heated bays" },
  { id: "dome", label: "Golf dome", detail: "Indoors" },
  { id: "sim", label: "Simulator bays", detail: "Indoor screens" },
];

const input = "h-10 rounded-md border-2 border-edge bg-surface px-3 text-body";
const label = "flex flex-col gap-1 text-label font-semibold text-muted";

export function RequestPlaceForm() {
  const router = useRouter();
  const { db, isLoaded, userId } = useDb();
  const { reload } = useAddedPlaces();
  const [name, setName] = useState("");
  const [town, setTown] = useState("");
  const [address, setAddress] = useState("");
  const [where, setWhere] = useState<LatLon | null>(null);
  const [kind, setKind] = useState<Kind>("outdoor");
  const [areas, setAreas] = useState<AreaKind[]>(["range"]);
  const [allDay, setAllDay] = useState(false);
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("21:00");
  const [hoursNote, setHoursNote] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const heading = (
    <div className="flex flex-col gap-1">
      <TextLink href="/" className="mb-2 w-fit">← All places</TextLink>
      <h1 className="text-display">Request a place</h1>
      <p className="text-body text-muted">
        For a range, dome or simulator place that isn&apos;t on Range Report yet. You can use it right away; only you can see it until a Range Report admin approves it.
      </p>
    </div>
  );

  if (isLoaded && !userId)
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {heading}
        <Card tone="cream" className="flex flex-col gap-3">
          <p className="text-body">Sign in to request a place. It&apos;s tied to your account, so it can stay private to you while it&apos;s reviewed.</p>
          <ButtonLink href={`/sign-in?redirect_url=${encodeURIComponent("/request-a-place")}`} className="w-fit">Sign in</ButtonLink>
        </Card>
      </div>
    );

  const pickKind = (k: Kind) => {
    setKind(k);
    setAreas(k === "dome" ? ["bays"] : k === "outdoor" ? ["range"] : []);
  };
  const toggleArea = (a: AreaKind) => setAreas((xs) => (xs.includes(a) ? xs.filter((x) => x !== a) : [...xs, a]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 3) return setError("Add the place's name.");
    if (town.trim().length < 2) return setError("Add the town or neighborhood it's in.");
    if (!where) return setError("Put a pin on the map where it is.");
    if (kind !== "sim" && areas.length === 0) return setError("Pick at least one thing you can practice there.");
    if (!allDay && open === close) return setError("The opening and closing times are the same. Pick Open 24/7 if it never closes.");
    const site = website.trim();
    if (site && !/^https?:\/\/\S{3,200}$/.test(site)) return setError("The website should start with https://");
    setBusy(true);
    const { data, error } = await db.rpc("request_place", {
      p_name: name.trim(),
      p_neighborhood: town.trim(),
      p_address: address.trim().slice(0, 160),
      p_lat: where.lat,
      p_lon: where.lon,
      p_kind: kind === "sim" ? "sim" : "walk_in",
      p_areas: requestAreas(kind === "sim" ? "sim" : "walk_in", areas, kind === "dome"),
      p_hours: requestHours(allDay, open, close),
      p_hours_note: hoursNote.trim(),
      p_website: site,
    });
    if (error) {
      setBusy(false);
      return setError(error.code === "RR429" ? `${error.message}. You can ask for more once an admin has looked at those.` : `Couldn't send it: ${error.message}`);
    }
    await reload();
    router.push(`/places/${data as string}`);
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-2xl flex-col gap-6" noValidate>
      {heading}
      {error && <Alert tone="error" title={error} onDismiss={() => setError(null)} />}

      <Card className="flex flex-col gap-4">
        <h2 className="text-heading">The place</h2>
        <label className={label}>
          Name
          <input className={input} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Lakeshore Golf Center" />
        </label>
        <label className={label}>
          Town or neighborhood
          <input className={input} value={town} maxLength={60} onChange={(e) => setTown(e.target.value)} placeholder="Milwaukee, WI" />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label font-semibold text-muted">Where it is</legend>
          <LocationPicker value={where} onChange={setWhere} onFound={(a) => setAddress(a)} />
        </fieldset>
        <label className={label}>
          Address (optional)
          <input className={input} value={address} maxLength={160} onChange={(e) => setAddress(e.target.value)} placeholder="Filled in when you pick a search result" />
        </label>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-heading">What it has</h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-label font-semibold text-muted">What kind of place</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => (
              <label key={k.id} className={cx("flex cursor-pointer flex-col rounded-lg border-2 px-3 py-2", kind === k.id ? "border-green bg-open-tint" : "border-edge/40 hover:bg-cream")}>
                <span className="flex items-center gap-2 text-body font-semibold text-ink">
                  <input type="radio" name="kind" checked={kind === k.id} onChange={() => pickKind(k.id)} />
                  {k.label}
                </span>
                <span className="pl-6 text-label font-normal text-muted">{k.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {kind !== "sim" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label font-semibold text-muted">What you can practice there</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {AREA_CHOICES.map((a) => (
                <label key={a.kind} className="flex items-center gap-2 text-body text-ink">
                  <input type="checkbox" checked={areas.includes(a.kind)} onChange={() => toggleArea(a.kind)} />
                  {a.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-heading">Hours</h2>
        <label className="flex items-center gap-2 text-body text-ink">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Open 24/7
        </label>
        {!allDay && (
          <div className="flex flex-wrap gap-4">
            <label className={label}>
              Opens (every day)
              <input type="time" className={input} value={open} onChange={(e) => setOpen(e.target.value)} />
            </label>
            <label className={label}>
              Closes
              <input type="time" className={input} value={close} onChange={(e) => setClose(e.target.value)} />
            </label>
          </div>
        )}
        <label className={label}>
          Anything else about the hours (optional)
          <input className={input} value={hoursNote} maxLength={200} onChange={(e) => setHoursNote(e.target.value)} placeholder="Closes at 5 on Sundays; shorter in winter" />
        </label>
        <label className={label}>
          Website (optional)
          <input className={input} value={website} maxLength={200} inputMode="url" onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
        </label>
      </Card>

      <div className="flex flex-col gap-2">
        <p className="text-label font-normal text-muted">
          Until it&apos;s approved, the place and your reports there are visible only to you. Once an admin approves it, it&apos;s a place for everyone, and your reports there are shared like any other report.
        </p>
        <Button type="submit" disabled={busy} className="w-fit">{busy ? "Sending…" : "Send the request"}</Button>
      </div>
    </form>
  );
}
