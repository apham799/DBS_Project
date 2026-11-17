// The Groq key is temporary on purpose: 30 days from when it was added
// (Nov 17, 2026). From this moment on the app treats GROQ_API_KEY as if it
// weren't set, so the AI summary turns itself off even if the key is never
// removed from .env.local or Vercel. To extend it, change this date.
export const GROQ_KEY_EXPIRES = new Date("2026-12-17T00:00:00-06:00"); // midnight, Chicago

// The key if it's set and not past its date; null otherwise.
export function activeKey(key: string | undefined, now: Date, expires: Date = GROQ_KEY_EXPIRES): string | null {
  if (!key || !key.trim()) return null;
  return now.getTime() < expires.getTime() ? key.trim() : null;
}
