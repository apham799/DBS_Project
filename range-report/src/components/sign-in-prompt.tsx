"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui";

// Asking people to sign in only when they do something that needs it (from v1
// feedback), and saying what they get for it. One pop-up for the whole app,
// opened from anywhere with askToSignIn(); it sits in the root layout.
//
// A native <dialog>: focus moves in and back when it closes; Esc, "Not now" or
// a click outside close it. Sign in / up return you to the page you were on.

const EVENT = "range-report:ask-sign-in";

// next: where to land after signing in (default: the page you were on).
// guest: an option to carry on without an account (e.g. post as a guest).
export type SignInAsk = { title: string; reason: string; next?: string; guest?: { label: string; href: string } };

export const askToSignIn = (ask: SignInAsk) => window.dispatchEvent(new CustomEvent<SignInAsk>(EVENT, { detail: ask }));

// A follow asked for while signed out, applied once you've signed in (use-follows.ts).
export const PENDING_FOLLOW_KEY = "range-report:pending-follow";

export function SignInPrompt() {
  const ref = useRef<HTMLDialogElement>(null);
  const [ask, setAsk] = useState<SignInAsk | null>(null);
  const path = usePathname();

  useEffect(() => {
    const open = (e: Event) => {
      setAsk((e as CustomEvent<SignInAsk>).detail);
      ref.current?.showModal();
    };
    window.addEventListener(EVENT, open);
    return () => window.removeEventListener(EVENT, open);
  }, []);

  const back = encodeURIComponent(ask?.next ?? path);
  const close = () => ref.current?.close();

  return (
    <dialog
      ref={ref}
      aria-labelledby="sign-in-title"
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-xl border border-rule bg-surface p-0 text-ink shadow-lift backdrop:bg-ink/40"
    >
      {ask && (
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <h2 id="sign-in-title" className="text-heading">{ask.title}</h2>
            <p className="text-body text-muted">{ask.reason}</p>
          </div>
          <ul className="flex flex-col gap-2 rounded-lg bg-cream p-4 text-body">
            <li className="flex gap-2"><Tick />Follow your places, so they stay at the top</li>
            <li className="flex gap-2"><Tick />Keep a private log of each session: what you worked on, only for you</li>
            <li className="flex gap-2"><Tick />Free. Your reports are still shared without your name</li>
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href={`/sign-up?redirect_url=${back}`} onClick={close}>Sign up</ButtonLink>
            <ButtonLink href={`/sign-in?redirect_url=${back}`} variant="secondary" onClick={close}>Sign in</ButtonLink>
            <button type="button" onClick={close} className="ml-auto rounded-sm px-2 py-2 text-body font-semibold text-muted hover:text-ink hover:underline">
              Not now
            </button>
          </div>
          {ask.guest && (
            <p className="border-t border-rule pt-3 text-body text-muted">
              Or{" "}
              <Link href={ask.guest.href} onClick={close} className="rounded-sm font-semibold text-green underline decoration-green/40 decoration-2 underline-offset-[3px] hover:decoration-green">
                {ask.guest.label}
              </Link>
              , without an account. It shows as a guest report.
            </p>
          )}
        </div>
      )}
    </dialog>
  );
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 text-open" aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />
    </svg>
  );
}
