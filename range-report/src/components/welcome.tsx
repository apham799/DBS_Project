"use client";

import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { StateIcon } from "@/components/status";
import { Button, ButtonLink, cx, TextLink } from "@/components/ui";

// A short "what is this?" for people who aren't signed in: most of them
// arrive from a friend's link and have never seen the site. Shown once per
// browser (remembered in localStorage), never on the sign-in/up pages, and
// reopened any time with openWelcome() (the home page's "How it works").
//
// A native <dialog> opened with showModal(): focus moves into it and stays
// there, Esc closes it, and the page behind can't be clicked or read by
// screen readers, all without extra code.

const SEEN_KEY = "range-report:welcomed";
const OPEN_EVENT = "range-report:open-welcome";

export const openWelcome = () => window.dispatchEvent(new Event(OPEN_EVENT));

const legend: { state: "open" | "limited" | "closed"; word: string; tone: string }[] = [
  { state: "open", word: "Good", tone: "border-open bg-open-tint text-open" },
  { state: "limited", word: "Limited", tone: "border-limited bg-limited-tint text-limited" },
  { state: "closed", word: "Closed", tone: "border-closed bg-closed-tint text-closed" },
];

export function Welcome() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const ref = useRef<HTMLDialogElement>(null);
  const authPage = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");

  // First visit, signed out: open it once.
  useEffect(() => {
    if (!isLoaded || isSignedIn || authPage) return;
    if (localStorage.getItem(SEEN_KEY)) return;
    localStorage.setItem(SEEN_KEY, "1");
    ref.current?.showModal();
  }, [isLoaded, isSignedIn, authPage]);

  // "How it works" from anywhere.
  useEffect(() => {
    const open = () => ref.current?.showModal();
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      aria-labelledby="welcome-title"
      // A click on the dimmed backdrop lands on the <dialog> itself: close.
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[min(34rem,calc(100%-2rem))] rounded-lg border border-rule bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="welcome-title" className="text-display">Know what&apos;s open before you drive</h2>
          <button type="button" onClick={close} aria-label="Close" className="-mr-2 -mt-1 rounded-md p-2 text-muted hover:bg-cream hover:text-ink">
            <svg viewBox="0 0 16 16" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4 L12 12 M12 4 L4 12" />
            </svg>
          </button>
        </div>

        <p className="text-body">
          Published hours say a Chicago practice spot is open. Range Report says whether the part you need is: golfers who were just there post a
          quick report on the range, chipping, putting and bunkers, and how busy it was.
        </p>

        <ul className="flex flex-col gap-3 text-body">
          <li className="flex flex-col gap-1.5">
            <span className="font-semibold">Each area shows what golfers found</span>
            <span className="flex flex-wrap gap-1.5" aria-hidden>
              {legend.map((l) => (
                <span key={l.state} className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-label font-semibold", l.tone)}>
                  <StateIcon state={l.state} className="size-3.5" />
                  {l.word}
                </span>
              ))}
            </span>
            <span className="text-label font-normal text-muted">A solid outline is a report from today; dashed or dotted means less sure (older, or the place&apos;s published season).</span>
          </li>
          <li className="flex flex-col gap-0.5">
            <span className="font-semibold">Free to look, no account needed</span>
            <span className="text-label font-normal text-muted">
              Sign up to follow your places and post what you find. Reports are shared without your name, and you keep a private log of each session.
            </span>
          </li>
        </ul>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/sign-up" onClick={close}>Sign up</ButtonLink>
            <Button variant="secondary" onClick={close} autoFocus>Look around first</Button>
          </div>
          {/* Returning golfers on a new phone or browser see this too. Sign-in
              brings them back to the page they were on. */}
          <p className="text-body text-muted">
            Been here before?{" "}
            <TextLink href={`/sign-in?redirect_url=${encodeURIComponent(pathname)}`} onClick={close}>Sign in</TextLink>
          </p>
        </div>
      </div>
    </dialog>
  );
}
