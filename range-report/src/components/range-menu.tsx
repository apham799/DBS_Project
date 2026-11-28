"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "@/components/ui";
import { REPORT_RANGES, type ReportRange } from "@/lib/report-range";

// "Last 30 days ▾": a filter button that opens a short menu of time ranges,
// like most filter menus. One choice at a time (menuitemradio). Opening moves
// focus to the current choice; ↑/↓ move, Enter or a click picks, Esc or a
// click outside closes, and focus goes back to the button.
export function RangeMenu({ value, onChange }: { value: ReportRange; onChange: (r: ReportRange) => void }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = REPORT_RANGES.find((r) => r.id === value)!;

  const items = () => [...(menu.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
  const close = (focusButton = true) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    // Focus the current choice once the menu is drawn.
    requestAnimationFrame(() => items().find((b) => b.getAttribute("aria-checked") === "true")?.focus());
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onKey = (e: KeyboardEvent) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      list[(at + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      list[e.key === "Home" ? 0 : list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(
          "inline-flex h-10 items-center gap-2 rounded-md border-2 bg-surface px-3 text-label font-semibold text-ink transition-colors hover:bg-cream",
          open ? "border-green" : "border-edge/40",
        )}
      >
        {/* A filter funnel, so it reads as a filter, not a heading. */}
        <svg viewBox="0 0 16 16" className="size-4 text-muted" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M2 3 H14 L9.5 8.5 V13 L6.5 11.5 V8.5 Z" />
        </svg>
        <span className="sr-only">Time range: </span>
        {current.label}
        <svg viewBox="0 0 16 16" className={cx("size-4 transition-transform duration-200", open && "rotate-180")} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6 L8 10 L12 6" />
        </svg>
      </button>

      {open && (
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label="Time range"
          onKeyDown={onKey}
          className="absolute left-0 z-20 mt-1.5 flex w-48 sm:left-auto sm:right-0 flex-col rounded-lg border border-rule bg-surface py-1 shadow-lift motion-safe:animate-[rr-menu-in_150ms_ease-out]"
        >
          <p className="px-3 pb-1 pt-1.5 text-label font-semibold text-muted" aria-hidden>
            Time range
          </p>
          {REPORT_RANGES.map((r) => {
            const on = r.id === value;
            return (
              <button
                key={r.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                tabIndex={-1}
                onClick={() => {
                  onChange(r.id);
                  close();
                }}
                className={cx(
                  "flex items-center justify-between gap-3 px-3 py-2 text-left text-body outline-none hover:bg-cream focus-visible:bg-cream",
                  on ? "font-semibold text-green" : "text-ink",
                )}
              >
                {r.label}
                {on && (
                  <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
