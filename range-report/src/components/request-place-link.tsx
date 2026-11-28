"use client";

import Link from "next/link";
import { askToSignIn } from "@/components/sign-in-prompt";
import { useDb } from "@/lib/db";

const link = "rounded-sm font-semibold text-green underline decoration-green/40 decoration-2 underline-offset-[3px] hover:decoration-green";

// "Don't see your place? Request it." Signed out, it asks to sign in first
// (a request is tied to an account, so it can be private to you meanwhile).
export function RequestPlaceLink() {
  const { userId } = useDb();
  return (
    <p className="text-body text-muted">
      Don&apos;t see your place, or practice outside Chicago?{" "}
      {userId ? (
        <Link href="/request-a-place" className={link}>Request a place</Link>
      ) : (
        <button
          type="button"
          className={link}
          onClick={() =>
            askToSignIn({
              title: "Request a place",
              reason: "Sign in to ask for a place. You can use it right away, just for you, while an admin reviews it.",
              next: "/request-a-place",
            })
          }
        >
          Request a place
        </button>
      )}
    </p>
  );
}
