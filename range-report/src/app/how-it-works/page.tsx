import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StateIcon } from "@/components/status";
import { ButtonLink, Card, cx, TextLink } from "@/components/ui";

export const metadata: Metadata = { title: "How it works" };

// What used to be the first-visit pop-up, as a page you can open when you
// want it (from v1 feedback: no wall of text over the home page).

const swatch = "inline-block h-4 w-7 shrink-0 rounded-sm border-2";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green font-display text-lg font-semibold text-on-green [font-variant-numeric:lining-nums]" aria-hidden>
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-heading">{title}</h3>
        <div className="text-body text-muted">{children}</div>
      </div>
    </li>
  );
}

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
      <section className="flex flex-col gap-3">
        <TextLink href="/" className="w-fit">← All places</TextLink>
        <h1 className="text-display">How Range Report works</h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted">
          Published hours say a Chicago practice spot is open. They don&apos;t say whether the part you need is: if the short game area is roped off, the range is mats
          only, or there&apos;s a wait. Golfers who were just there do.
        </p>
      </section>

      <ol className="flex flex-col gap-6">
        <Step n={1} title="Find your place">
          Each place shows its hours (green when open, yellow when it closes within the hour, red when closed) and what golfers last said about each area.
        </Step>
        <Step n={2} title="Check the part you need">
          A place&apos;s page has a sketch of the facility with each area colored by what golfers found. Tap an area for its latest rating and the last 30 days.
        </Step>
        <Step n={3} title="Post what you found">
          After you practice, three taps: was it open, how was each area, how busy. Add a note for other golfers if you like. Reports are shared without your name.
        </Step>
      </ol>

      <div className="grid gap-6 md:grid-cols-2">
        <Card as="section" labelledBy="colors" className="flex flex-col gap-3">
          <h2 id="colors" className="text-heading">What the colors mean</h2>
          <ul className="flex flex-col gap-2 text-body">
            <li className="flex items-center gap-2 text-open"><StateIcon state="open" /><span className="font-semibold">Good</span><span className="text-muted">: working normally</span></li>
            <li className="flex items-center gap-2 text-limited"><StateIcon state="limited" /><span className="font-semibold">Limited</span><span className="text-muted">: usable, but mats only, part closed or poorly kept</span></li>
            <li className="flex items-center gap-2 text-closed"><StateIcon state="closed" /><span className="font-semibold">Closed</span></li>
            <li className="flex items-center gap-2 text-muted"><span className={cx(swatch, "h-3.5 w-5 border-edge/40 bg-surface")} />No current report: nothing known beyond the hours</li>
          </ul>
        </Card>
        <Card as="section" labelledBy="sure" className="flex flex-col gap-3">
          <h2 id="sure" className="text-heading">How sure is it?</h2>
          <ul className="flex flex-col gap-2 text-body text-muted">
            <li className="flex items-center gap-2"><span className={cx(swatch, "border-ink")} />Solid: a golfer reported it in the last day</li>
            <li className="flex items-center gap-2"><span className={cx(swatch, "border-dashed border-ink")} />Dashed: reported this week, probably still true</li>
            <li className="flex items-center gap-2"><span className={cx(swatch, "border-dotted border-ink")} />Dotted: the place&apos;s published season, or the weather</li>
            <li className="flex items-center gap-2"><span className={cx(swatch, "border-limited bg-limited-tint opacity-55")} />Faded: the last thing known, while the place is closed</li>
          </ul>
        </Card>
      </div>

      <Card as="section" tone="cream" labelledBy="account" className="flex flex-col gap-3">
        <h2 id="account" className="text-heading">Do I need an account?</h2>
        <p className="text-body">
          No. Looking around is free and needs nothing. With an account you can follow the places you practice, so they stay at the top, and every report you post goes into
          your own private practice log: what you worked on and whether a report changed your plans. Only you can see it.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/#places">Find a place</ButtonLink>
          <ButtonLink href="/sign-up" variant="secondary">Sign up</ButtonLink>
        </div>
      </Card>
    </div>
  );
}
