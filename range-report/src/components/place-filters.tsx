"use client";

import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { FEATURES, isFiltering, NO_FILTERS, type Feature, type Filters, type Setting } from "@/lib/filters";

// The filters above the place list: what you need (any number, all must
// match), indoor or outdoor, and open now. These are real buttons, so they
// look like buttons (unlike the ratings, which are data).

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "inline-flex h-10 items-center gap-1.5 rounded-full border-2 px-4 text-label font-semibold transition-colors",
        on ? "border-green bg-green text-on-green" : "border-edge/40 bg-surface text-ink hover:border-green hover:bg-cream",
      )}
    >
      {on && (
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
        </svg>
      )}
      {children}
    </button>
  );
}

const SETTINGS: { id: Setting | null; label: string }[] = [
  { id: null, label: "Any" },
  { id: "outdoor", label: "Outdoor" },
  { id: "indoor", label: "Indoor" },
];

export function PlaceFilters({
  filters,
  onChange,
  shown,
  total,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  shown: number;
  total: number;
}) {
  const toggle = (f: Feature) =>
    onChange({ ...filters, features: filters.features.includes(f) ? filters.features.filter((x) => x !== f) : [...filters.features, f] });

  return (
    <div className="rr-reveal flex flex-col gap-3 rounded-xl border border-rule bg-surface p-4" role="group" aria-label="Filter places">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
        <span className="text-label font-semibold text-muted lg:w-28 lg:shrink-0">I need</span>
        <div className="flex flex-wrap gap-2">
          {FEATURES.map((f) => (
            <Chip key={f.id} on={filters.features.includes(f.id)} onClick={() => toggle(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
        <span className="text-label font-semibold text-muted lg:w-28 lg:shrink-0">Setting</span>
        <div className="flex flex-wrap items-center gap-2">
          {SETTINGS.map((s) => (
            <Chip key={s.label} on={filters.setting === s.id} onClick={() => onChange({ ...filters, setting: s.id })}>
              {s.label}
            </Chip>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-rule sm:block" aria-hidden />
          <Chip on={filters.openNow} onClick={() => onChange({ ...filters, openNow: !filters.openNow })}>
            Open now
          </Chip>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-3 text-label text-muted">
        <span role="status">
          {isFiltering(filters) ? `Showing ${shown} of ${total} places` : `All ${total} places`}
        </span>
        {isFiltering(filters) && (
          <button
            type="button"
            onClick={() => onChange(NO_FILTERS)}
            className="rounded-sm font-semibold text-green underline decoration-green/40 decoration-2 underline-offset-[3px] hover:decoration-green"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
