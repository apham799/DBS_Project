# Range Report

Live: **https://range-report-eight.vercel.app**

Published hours say a Chicago practice spot is open. Range Report says whether the part you need is. Golfers who were just there post a quick report (was it open; how were the range, chipping, putting and bunker; how busy), and everyone sees each area's status right now on a sketch of the facility, colored by condition. Reports are kept forever. Each post also goes into the poster's private practice log, which is the reason to post at all.

Built for Design, Build, Ship (MPCS 51238), Autumn 2026. Focus: **systems**. The fair demo is in [`docs/demo.md`](docs/demo.md); the v2 plan and what changed after the v1 feedback are in [`docs/v2-plan.md`](docs/v2-plan.md).

## What it does

- **Before you drive:** nine places in and around Chicago, each with its hours badge (open, closing within the hour, closed). A card's **Details** show what golfers say about each area, when the last report came in, how many reports there are, and the weather. Your followed places come first; the rest fold away.
- **Filters** (shared by Home and the map): what you want to practice (range, heated bays, short game, putting, simulators), indoor or outdoor, open now, and **Reports from** everyone, golfers with accounts, or guests.
- **City map** (`/map`): every place as a pin on OpenStreetMap, colored like its hours badge, with a card for the picked place. Drag to move; Ctrl/⌘ + scroll or pinch to zoom.
- **Facility heat map:** each place's areas drawn as a sketch (not to scale), filled by status and outlined by how sure we are. Click or press Enter on an area for its latest rating, its 30-day counts, and any admin's note.
- **Post a report** in three taps, plus an optional public note (280 characters, no links) and private notes for your log. **No account needed:** guests can post too, marked "Guest".
- **What golfers say:** a rule-based summary of the last 30 days, an AI-written paragraph once a place has 3 public notes, and **Patterns** from all of a place's history ("usually quiet on Tuesday mornings", "range usually limited in November"), rebuilt every night.
- **Recent reports**, by past week, last 30 days, past year or all time. Golfers vote reports up or down; a report voted down by 2 more than up is hidden, like a hidden comment (still one click away).
- **Request a place** that isn't listed (outside Chicago, say): name, town, a pin on the map (search the address or click), what it has and its hours. You can use it right away, but **only you can see it, post there and read its reports** until an admin approves it; then it's a place for everyone.
- **My Log:** your own sessions, notes and whether Range Report changed the trip.
- **Live:** new reports, votes and admin changes appear on every open page without a reload.

## Admins

Some accounts are admins (the `private.admins` table; add one with an `insert` in the SQL editor). They get an **Admin** tab and admin boxes on each place page:

- **Suggestions** worked out from golfers' reports (`src/lib/suggestions.ts`): golfers agree on an area that nothing confirms yet; a published season golfers contradict; a confirmed status recent reports disagree with; notes mentioning a different closing time. The app only suggests; an admin confirms, edits or dismisses.
- **Confirm a status** for an area or the whole place, with a note shown to golfers and optional dates. On the map, an area an admin set is lined with small stars; a whole place set by an admin gets one frame of stars around the map.
- **Place requests:** approve one (it becomes a place for everyone) or not (it stays private to the golfer who asked, with the admin's note).
- **Edit the hours** day by day (replacing the published ones until reset), **hide** a report with a reason, and **rebuild the patterns** now.

Every admin action is checked again in the database (`public.is_admin()`), whatever the app shows.

## How status works (`src/lib/status.ts`)

Every area's status is computed in the browser from the reports that count (not hidden, as "Reports from" says), the hours, what admins have confirmed, the published seasons (`src/data/places.ts`), the weather and the time, in this order:

1. **Hours** (an admin's, else the published ones). Closed by its hours: the badge says so, and the map shows each area's last known status, faded.
2. **Thunderstorm** nearby: outdoor areas are probably closed.
3. **"Closed when I got there"** covers every area for that golf day (rolling over at 4 AM), until anyone reports the place open again.
4. **The newest rating of the area:** "good" lasts a day; a problem is "reported" for a day, then "probably still" for up to 7 days.
5. **An admin's confirmed status** for the area, else for the whole place.
6. **The published season** (e.g. "mats only Nov 1 – Mar 31"), unless golfers have reported it working since the season began.
7. Otherwise: open by its hours, nothing reported.

Ratings that disagree within 3 hours are flagged "reports differ". Times are America/Chicago throughout. The browser clock is never allowed to fall behind the newest report (whose time comes from the database), so a slow device clock can't hide one.

## Architecture

- **Next.js 16** (App Router, Cache Components, Turbopack), **React 19**, **Tailwind 4**.
- **Clerk** for sign-in. **Supabase** (Postgres + Realtime) with Clerk as a third-party auth provider, so row-level security reads the Clerk user id from the token.
- **Patterns job:** `pg_cron` runs `private.rebuild_place_patterns()` inside the database every night at 10:10 UTC (4:10 AM in Chicago), rebuilding `place_patterns` from all report history: crowd by weekday and part of the day, and each area's usual rating by month. A pattern needs 3+ reports with 60%+ agreeing.
- **Map:** Leaflet with OpenStreetMap tiles (no key), loaded in the browser only.
- **Weather:** Open-Meteo, one batched call shared by everyone, cached 15 minutes (`src/lib/weather-server.ts`, `/api/weather`).
- **AI summary:** Groq (`openai/gpt-oss-120b`) via `/api/summary/[id]`, cached by the report text, so the model runs once per new report. The key is treated as unset after a fixed date (`src/lib/ai-key.ts`).

## Privacy and safety (`supabase/migrations/`)

- **Reports are public and carry no user id at all.** The only link from a report to a person is that person's private practice log.
- **Practice logs, follows and votes are private:** row-level security returns only your own rows.
- **Posting has two doors, and no others:** `post_report()` for signed-in golfers (writes the report and its private log together; at most one report per place every 10 minutes and 20 a day per person) and `post_guest_report()` for guests (the report only, marked `source = 'guest'`). Both check that the areas belong to the place and make retries safe (the form sends its own id). Direct inserts are revoked.
- **Guest limits without tracking people:** a guest's device is a salted SHA-256 hash of its IP (from Cloudflare's `cf-connecting-ip`), kept in a private schema the API can't reach and deleted after a day. One guest report per place every 10 minutes and 10 a day per device, and at most 6 guest reports per place per hour overall.
- **Votes** go through `vote_report()` only (one per golfer per report, never on your own); the counts on a report are written by the database, not the browser.
- **Admin changes** (`admin_set_rule`, `admin_set_hours`, `admin_hide_report`, `admin_rebuild_patterns`, …) are security-definer functions that check the admin list first. Nobody can update or delete a report through the API; hidden reports are kept.
- **Requested places** (`added_places`) are private until approved, enforced in the database: reports are readable only at places you can see (`place_visible()`), and a trigger refuses a report at a place you can't see, whichever function posts it. Admins can read a request to review it, but not its reports. Who asked is never readable through the API (column grants). Patterns leave private places out. Checked in [`supabase/tests/added_places.sql`](supabase/tests/added_places.sql).
- Column-level grants mean nobody can backdate a report or file one under someone else.
- These rules were tested on the live database by impersonating golfers, a guest and an admin inside transactions that roll back. The patterns job has its own check: [`supabase/tests/place_patterns.sql`](supabase/tests/place_patterns.sql).

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest: status and hours, filters, Reports from, hidden reports, summary, patterns, suggestions, report ranges, admin settings, weather scene, AI key cutoff
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

The database schema is in `supabase/migrations/`, applied in order (the patterns migration also turns on `pg_cron` and schedules the nightly job).

The `testing` branch adds a "Test as Golfer A / B / C / Admin" sign-in for local development only (see `docs/testing.md` there); it never runs in a production build.

## Deploying

A Vercel project with **Root Directory = `range-report`** (the repo also holds the project proposal page). Add the same environment variables there.
