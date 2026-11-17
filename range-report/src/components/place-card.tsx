"use client";

import Link from "next/link";
import { AreaDots, crowdWord, headline, HoursBadge, NoDataIcon } from "@/components/status";
import { Badge, cx } from "@/components/ui";
import { ageLabel, type PlaceStatus } from "@/lib/status";
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
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill={following ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M8 1.8 L9.9 5.7 L14.2 6.3 L11.1 9.3 L11.8 13.6 L8 11.6 L4.2 13.6 L4.9 9.3 L1.8 6.3 L6.1 5.7 Z" />
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
  return (
    <li
      className={cx(
        "relative flex flex-col gap-3 rounded-lg border bg-surface p-5 shadow-card transition-shadow hover:shadow-lift",
        highlight ? "border-green" : "border-rule",
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
          <p className="text-label font-normal text-muted">
            {place.neighborhood} · {place.kind === "sim" ? "Simulator bays" : "Walk-in range"}
          </p>
        </div>
        {onToggleFollow && (
          <div className="relative z-10">
            <FollowButton following={following} name={place.name} onToggle={onToggleFollow} />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <HoursBadge hours={status.hours} />
        {headline(status) && <p className="text-body font-semibold">{headline(status)}</p>}
      </div>
      <AreaDots status={status} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label font-normal text-muted">
        {status.crowd && <Badge tone="brass">{crowdWord[status.crowd.level]} · {status.crowd.age}</Badge>}
        {status.lastReportAt ? (
          <span>Last report {ageLabel(now.getTime() - new Date(status.lastReportAt).getTime())}</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <NoDataIcon className="size-4" />
            No reports yet
          </span>
        )}
        {weather && (
          <span>
            {weather.tempF}°F · {weather.label}
          </span>
        )}
      </div>
    </li>
  );
}
