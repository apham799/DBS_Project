"use client";

// A client component on purpose (from A5): the layout is kept across navigation,
// so a server-rendered header would keep showing "Sign in" after signing in.
//
// Navigation (from v1 feedback: "some kind of menu or navigation that lets the
// user click around"): Places, How it works and, signed in, My Log. On wide
// screens they sit in the bar (plus Admin, for admins); on phones they fold into a Menu button, which
// also stops "Sign up" running off the screen. The current page is marked
// (aria-current) and underlined.
import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ButtonLink, cx } from "@/components/ui";
import { useAllSuggestions } from "@/lib/use-all-suggestions";
import { useIsAdmin } from "@/lib/use-is-admin";

// Home listens for this to open its (possibly hidden) place list and scroll to it.
export const SHOW_PLACES_EVENT = "range-report:show-places";

type NavItem = { href: string; label: string; current: (path: string) => boolean; signedIn?: boolean };
const NAV: NavItem[] = [
  { href: "/#places", label: "Places", current: (p) => p === "/" || p.startsWith("/places") },
  { href: "/how-it-works", label: "How it works", current: (p) => p === "/how-it-works" },
  { href: "/log", label: "My Log", current: (p) => p === "/log", signedIn: true },
];
const ADMIN: NavItem = { href: "/admin", label: "Admin", current: (p) => p === "/admin", signedIn: true };

function NavLink({ item, path, onNavigate, block, badge }: { item: NavItem; path: string; onNavigate: () => void; block?: boolean; badge?: ReactNode }) {
  const current = item.current(path);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Already on Home: open the list and scroll there, instead of a navigation
    // that changes nothing (the URL may already be /#places).
    if (item.href === "/#places" && path === "/") {
      e.preventDefault();
      window.dispatchEvent(new Event(SHOW_PLACES_EVENT));
    }
    onNavigate();
  };
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={current ? "page" : undefined}
      className={cx(
        "rounded-sm font-semibold text-ink decoration-green decoration-2 underline-offset-[6px] hover:text-green hover:underline",
        current && "text-green underline",
        block ? "block px-2 py-3 text-body" : "px-1 py-2 text-body",
      )}
    >
      {item.label}
      {badge}
    </Link>
  );
}

function Links({ path, onNavigate, block }: { path: string; onNavigate: () => void; block?: boolean }) {
  return (
    <>
      {NAV.filter((i) => !i.signedIn).map((i) => (
        <NavLink key={i.href} item={i} path={path} onNavigate={onNavigate} block={block} />
      ))}
      <Show when="signed-in">
        {NAV.filter((i) => i.signedIn).map((i) => (
          <NavLink key={i.href} item={i} path={path} onNavigate={onNavigate} block={block} />
        ))}
        <AdminLink path={path} onNavigate={onNavigate} block={block} />
      </Show>
    </>
  );
}

// Admins only (the database's admin list). The count is loaded only for them.
function AdminLink(props: { path: string; onNavigate: () => void; block?: boolean }) {
  if (!useIsAdmin()) return null;
  return <NavLink item={ADMIN} {...props} badge={<AdminCount />} />;
}

function AdminCount() {
  const { total, loaded } = useAllSuggestions();
  if (!loaded || total === 0) return null;
  return (
    <span className="ml-1.5 inline-block rounded-full border border-limited bg-limited-tint px-2 py-px align-middle text-label font-semibold text-limited">
      {total}
      <span className="sr-only"> suggestion{total === 1 ? "" : "s"}</span>
    </span>
  );
}

export function Header() {
  const path = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const close = () => setOpenOn(null);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Esc or a tap outside closes the phone menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpenOn(null);
      button.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpenOn(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-30 border-b border-cream-deep bg-cream">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 2xl:px-16">
        <Link href="/" onClick={close} className="flex shrink-0 items-center gap-2 rounded-sm font-display text-xl font-semibold text-green">
          <svg viewBox="0 0 16 16" className="size-5 text-brass" aria-hidden fill="currentColor">
            <rect x="4" y="2" width="1.5" height="12" />
            <path d="M5.5 2.5 L12 5 L5.5 7.5 Z" />
          </svg>
          Range Report
        </Link>

        {/* Wide screens: everything in the bar. */}
        <nav aria-label="Main" className="hidden flex-1 items-center gap-5 md:flex">
          <Links path={path} onNavigate={close} />
        </nav>
        <div className="flex items-center gap-2">
          {/* Sign in / up sit in the bar on wide screens; on phones they're in the menu. */}
          <Show when="signed-out">
            <div className="hidden items-center gap-2 md:flex">
              <ButtonLink href="/sign-in" variant="ghost" size="sm">Sign in</ButtonLink>
              <ButtonLink href="/sign-up" size="sm">Sign up</ButtonLink>
            </div>
          </Show>
          <Show when="signed-in">
            {/* Inside the signed-in check: outside it, the browser drew its
                container while the server drew nothing (a hydration mismatch). */}
            <UserButton />
          </Show>
          <button
            ref={button}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpenOn(open ? null : path)}
            className="inline-flex h-10 items-center gap-2 rounded-md border-2 border-ink/15 bg-surface px-3 text-label font-semibold text-ink hover:bg-cream md:hidden"
          >
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M4 4 L12 12 M12 4 L4 12" /> : <path d="M2.5 4.5 H13.5 M2.5 8 H13.5 M2.5 11.5 H13.5" />}
            </svg>
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open && (
        <div ref={panel} id="mobile-menu" className="border-t border-cream-deep bg-cream px-4 pb-4 shadow-lift md:hidden">
          <nav aria-label="Main" className="flex flex-col divide-y divide-cream-deep">
            <Links path={path} onNavigate={close} block />
          </nav>
          <Show when="signed-out">
            <div className="mt-3 flex gap-2">
              <ButtonLink href="/sign-in" variant="secondary" size="sm" className="flex-1" onClick={close}>Sign in</ButtonLink>
              <ButtonLink href="/sign-up" size="sm" className="flex-1" onClick={close}>Sign up</ButtonLink>
            </div>
          </Show>
        </div>
      )}
    </header>
  );
}
