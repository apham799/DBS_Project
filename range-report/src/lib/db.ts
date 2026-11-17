"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo } from "react";

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
export const getGuestClient = () => (guestClient ??= createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } }));

// One client per signed-in person for the whole page session, not one per
// component: each client opens its own Realtime websocket. The token is read
// from the current Clerk instance at request time.
const userClients = new Map<string, SupabaseClient>();
let currentClerk: ReturnType<typeof useClerk> | null = null;
const getUserClient = (userId: string) => {
  let c = userClients.get(userId);
  if (!c) {
    c = createClient(URL_, KEY, { accessToken: async () => (await currentClerk?.session?.getToken()) ?? null });
    userClients.set(userId, c);
  }
  return c;
};

export function useDb() {
  const { isLoaded, userId } = useAuth();
  const clerk = useClerk();
  // Effects run in order, so this is set before any later effect in the same
  // component (a load, a subscribe) asks for a token.
  useEffect(() => {
    currentClerk = clerk;
  }, [clerk]);
  const db = useMemo(() => (userId ? getUserClient(userId) : getGuestClient()), [userId]);
  return { db, isLoaded, userId: userId ?? null };
}
