# Range Report

Live: **https://range-report-eight.vercel.app**

Published hours say a Chicago practice spot is open. Range Report says whether the part you need is. Golfers who were just there post a quick report (was it open; how were the range, chipping, putting and bunker; how busy), and everyone sees each area's status right now on a sketch of the facility, colored by condition. Reports are kept forever. Each post also goes into the poster's private practice log, which is the reason to post at all.

Built for Design, Build, Ship (MPCS 51238), Autumn 2026. Focus: **systems**.

## What it does

- **Before you drive:** every place with its hours badge (open, closing within the hour, closed) and its areas, with your followed places first.
- **Facility heat map:** each place's areas are drawn as a sketch (not to scale), filled by status and outlined by how sure we are. Tap or press Enter on an area for its latest rating and 30-day counts.
- **Post a report** in three taps, plus an optional public note (280 characters, no links) and private notes for your log.
- **What golfers say:** a rule-based summary of the last 30 days (area ratings, closed visits, when it's packed), and an AI-written paragraph once a place has 3 public notes.
- **My Log:** your own sessions, notes and whether Range Report changed the trip.
- **Live:** new reports appear on every open page without a reload.

## How status works (`src/lib/status.ts`)

Every area's status is computed in the browser from the reports, the published hours and seasons (`src/data/places.ts`), the weather and the time, in this order:

1. **Hours.** Closed by its hours: the badge says so, and the map shows each area's last known status, faded.
2. **Thunderstorm** nearby: outdoor areas are probably closed.
3. **"Closed when I got there"** covers every area for that golf day (rolling over at 4 AM), until anyone reports the place open again.
4. **The newest rating of the area:** "good" lasts a day; a problem is "reported" for a day, then "probably still" for up to 7 days.
5. **The published season** (e.g. "mats only Nov 1 – Mar 31"). A report from before a season began never overrides it.
6. Otherwise: open by its hours, nothing reported.

Ratings that disagree within 3 hours are flagged "reports differ". Times are America/Chicago throughout. The browser clock is never allowed to fall behind the newest report (whose time comes from the database), so a slow device clock can't hide one.

## Architecture

- **Next.js 16** (App Router, Cache Components, Turbopack), **React 19**, **Tailwind 4**.
- **Clerk** for sign-in. **Supabase** (Postgres + Realtime) with Clerk as a third-party auth provider, so row-level security reads the Clerk user id from the token.
- **Weather:** Open-Meteo, one batched call shared by everyone, cached 15 minutes (`src/lib/weather-server.ts`, `/api/weather`).
- **AI summary:** Groq (`openai/gpt-oss-120b`) via `/api/summary/[id]`, cached by the report text, so the model runs once per new report. The key is treated as unset after a fixed date (`src/lib/ai-key.ts`).

## Privacy and safety (`supabase/migrations/`)

- **Reports are public and carry no user id at all.** The only link from a report to a person is that person's private practice log.
- **Practice logs and follows are private:** row-level security returns only your own rows.
- **Posting has two doors, and no others:** `post_report()` for signed-in golfers (writes the report and its private log together; at most one report per place every 10 minutes and 20 a day per person) and `post_guest_report()` for guests (the report only, marked `source = 'guest'`). Both check that the areas belong to the place and make retries safe (the form sends its own id). Direct inserts are revoked.
- **Guest limits without tracking people:** a guest's device is a salted SHA-256 hash of its IP (from Cloudflare's `cf-connecting-ip`), kept in a private schema the API can't reach and deleted after a day. One guest report per place every 10 minutes and 10 a day per device, and at most 6 guest reports per place per hour overall. Guest reports are tagged in the app so they can be filtered out.
- Column-level grants mean nobody can backdate a report or file one under someone else.
- These rules were tested on the live database by impersonating two golfers and a guest inside a transaction that rolls back.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest: status, hours, summary, AI key cutoff
npx next build     # production build
```

`.env.local` needs (values from the Clerk and Supabase dashboards and the Groq console; never commit them):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
GROQ_API_KEY=          # optional: without it the AI summary stays off
```

The database schema is in `supabase/migrations/`, applied in order.

## Deploying

A Vercel project with **Root Directory = `range-report`** (the repo also holds the project proposal page). Add the same environment variables there.
