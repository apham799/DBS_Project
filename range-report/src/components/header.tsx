"use client";

// A client component on purpose (from A5): the layout is kept across navigation,
// so a server-rendered header would keep showing "Sign in" after signing in.
import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-cream-deep bg-cream">
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-10 2xl:px-16">
        <Link href="/" className="flex items-center gap-2 rounded-sm font-display text-xl font-semibold text-green">
          <svg viewBox="0 0 16 16" className="size-5 text-brass" aria-hidden fill="currentColor">
            <rect x="4" y="2" width="1.5" height="12" />
            <path d="M5.5 2.5 L12 5 L5.5 7.5 Z" />
          </svg>
          Range Report
        </Link>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <ButtonLink href="/sign-in" variant="ghost" size="sm">
              Sign in
            </ButtonLink>
            <ButtonLink href="/sign-up" size="sm">
              Sign up
            </ButtonLink>
          </Show>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
