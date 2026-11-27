"use client";

import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui";

// "Find a place": scrolls to an element on this page, every time it's clicked.
//
// A plain link to "#places" only worked once: after the first click the URL is
// already "/#places", so clicking again changes nothing and Next.js doesn't
// scroll, even if you've scrolled back up. This scrolls itself (smoothly,
// unless the system asks for less motion) and moves keyboard focus to the
// target, so screen reader users land there too. Without JavaScript it's
// still an ordinary link.

export function ScrollLink({ to, children, size = "lg", className, label }: { to: string; children: ReactNode; size?: "md" | "lg"; className?: string; label?: string }) {
  return (
    <a
      href={`#${to}`}
      aria-label={label}
      className={className ?? buttonClasses({ size })}
      onClick={(e) => {
        const target = document.getElementById(to);
        if (!target) return;
        e.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        target.focus({ preventScroll: true });
        history.replaceState(null, "", `#${to}`);
      }}
    >
      {children}
    </a>
  );
}
