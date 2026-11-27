"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { AreaDots, crowdWord, headline, HoursBadge, NoDataIcon, SettingBadge } from "@/components/status";
import { Badge, cx } from "@/components/ui";
import { ageLabel, type PlaceStatus } from "@/lib/status";
import { placeKindLabel } from "@/data/places";
import { settingOf } from "@/lib/filters";
import type { Place } from "@/lib/types";
import type { PlaceWeather } from "@/lib/weather-server";

export function FollowButton({ following, name, onToggle }: { following: boolean; name: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={following}
      aria-label={following ? `Unfollow ${name}` : `Follow ${name}`}
      className={cx(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border-2 px-3 text-label transition-colors",
        following ? "border-green bg-green text-on-green hover:bg-green-deep" : "border-ink bg-surface text-ink hover:bg-cream",
      )}
    >
      {/* A bookmark, not a star: stars mean an admin set a status. */}
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill={following ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M4 2 H12 V14 L8 10.8 L4 14 Z" />
      </svg>
      {following ? "Following" : "Follow"}
    </button>
  );
}

export function PlaceCard({
  place,
  status,
  weather,
  now,
  following,
  onToggleFollow,
  highlight,
}: {
  place: Place;
  status: PlaceStatus;
  weather?: PlaceWeather;
  now: Date;
  following: boolean;
  onToggleFollow?: () => void;
  highlight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const edge = highlight ? "border-green" : "border-rule";
  // Cards in a row line up: each one is a subgrid over the list's rows (name,
  // hours badge, Details, opened details), so a name that wraps onto two lines
  // moves the badge and Details down in every card of its row, and all the
  // cards end level. The opened details sit in the fourth row, outside the
  // card's box, joined to it: only that card grows; its neighbors stay short.
  return (
    <li className="rr-reveal row-span-4 grid grid-rows-subgrid gap-y-0">
      <div
        className={cx(
          "relative row-span-3 grid grid-rows-subgrid gap-y-3 border bg-surface p-5 shadow-card transition-shadow hover:shadow-lift",
          open ? "rounded-t-lg border-b-0 pb-3" : "rounded-lg",
          edge,
        )}
      >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-heading">
            {/* The whole card is clickable through this link's ::after; the follow button sits above it. */}
            <Link href={`/places/${place.id}`} className="rounded-sm after:absolute after:inset-0 after:rounded-lg hover:underline">
              {place.name}
            </Link>
          </h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label font-normal text-muted">
            <SettingBadge setting={settingOf(place)} />
            <span>{place.neighborhood} · {placeKindLabel(place)}</span>
          </p>
        </div>
        {onToggleFollow && (
          <div className="relative z-10">
            <FollowButton following={following} name={place.name} onToggle={onToggleFollow} />
          </div>
        )}
      </div>

      {/* Always shown: whether it's open. */}
      <div>
        <HoursBadge hours={status.hours} />
      </div>

      {/* Everything else opens on demand, so the list stays easy to scan.
          The button sits above the card's link (z-10), like Follow. It spans
          the whole row (a bigger target than the word), with no border until
          hovered, when a faint outline shows how far it reaches. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen(!open)}
        className="relative z-10 -mx-2 -my-1 flex w-[calc(100%+1rem)] items-center self-end gap-1 rounded-md border border-transparent px-2 py-2 text-left text-label font-semibold text-green transition-colors hover:border-ink/15 hover:bg-cream/40"
      >
        {open ? "Hide details" : "Details"}
        <svg viewBox="0 0 16 16" className={cx("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6 L8 10 L12 6" />
        </svg>
      </button>
      </div>

      {/* The fourth row: the opened details (joined to the card above), and
          the space before the next row of cards either way. */}
      <div className="pb-4">
      <div id={detailsId} hidden={!open} className={cx("relative flex flex-col gap-3 rounded-b-lg border border-t-0 bg-surface px-5 pb-5 shadow-card", edge)}>
        <div className="flex flex-col gap-3 border-t border-rule pt-3">
        {headline(status) && <p className="text-body font-semibold">{headline(status)}</p>}
        <AreaDots status={status} />
        {status.crowd && <Badge tone="brass">{crowdWord[status.crowd.level]} · {status.crowd.age}</Badge>}
        {/* Two labeled lines: a golfer's report and the weather are different things. */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-label">
          <dt className="font-semibold text-muted">Golfer report</dt>
          <dd className="text-ink">
            {status.lastReportAt ? (
              ageLabel(now.getTime() - new Date(status.lastReportAt).getTime())
            ) : (
              <span className="inline-flex items-center gap-1 text-muted">
                <NoDataIcon className="size-4" />
                None yet
              </span>
            )}
          </dd>
          {weather && (
            <>
              <dt className="font-semibold text-muted">Weather now</dt>
              <dd className="text-ink">
                {weather.tempF}°F, {weather.label.toLowerCase()}
              </dd>
            </>
          )}
        </dl>
        </div>
      </div>
      </div>
    </li>
  );
}
