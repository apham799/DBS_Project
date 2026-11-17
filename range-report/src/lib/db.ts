"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

// One Supabase client per person (or one shared guest client), as in A5.
//
// Signed in: every request and the Realtime socket carry the Clerk session token,
// so row-level security applies. The app never sends user_id; the database fills
// it in from the token.
// Guest: the publishable key only (the anon role), which can read reports and
// nothing else.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

let guestClient: SupabaseClient | null = null;
const getGuestClient = () => (guestClient ??= createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }));

export function useDb() {
  const { isLoaded, userId } = useAuth();
  const clerk = useClerk();
  const db = useMemo(
    () => (userId ? createClient(URL_, KEY, { accessToken: async () => (await clerk.session?.getToken()) ?? null }) : getGuestClient()),
    [clerk, userId],
  );
  return { db, isLoaded, userId: userId ?? null };
}
