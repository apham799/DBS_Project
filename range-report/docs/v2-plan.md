# Range Report: plan for v2 (fair on Dec 1, 2026)

Written Nov 17, 2026, the day v1 shipped. Based on the project proposal's roadmap, the TA's feedback ("less, done well"; check in with users at checkpoints) and a heat map of each facility.

## Update Nov 27: plan after the v1 feedback (4 days to the fair)

**Where it stands:** 5 real reports from 3 people, 1 changed decision, 5 follows, and no new reports since Nov 17. Another 3 reports came from the test golfers and are showing on the live site: delete them before the checkpoint (`docs/testing.md` on the `testing` branch).

**Lauren's v1 feedback** (video, kept local, not in the repo):

- She liked the colors, the readable font and the concept.
- The welcome pop-up is a wall of text on top of a busy page. Drop it for a simpler landing section (tagline, a golf visual), then scroll to the places.
- Only ask people to sign in when they do something that needs it, and add real navigation (a menu).
- Cards are hard to scan: "Range" shows on some and not others, and she wasn't sure it meant a driving range. She suggests filters ("I want a driving range / I don't care").
- "Last report 5 days ago" sits next to the weather and reads like a weather report.
- After signing in, it isn't clear what you gain.
- "Why do I have to sign in to post? Couldn't someone just spam-create an account?"

**Decided (Nov 27):**

- Guests can post. Tapping Post offers sign-in or sign-up with what you gain (a private log, follows), but you can skip it.
- Guest reports are marked as guest reports.
- One filter, **Reports from: Everyone / Golfers with accounts / Guests**, applies to everything computed from reports.
- Scope: Lauren's fixes, plus the patterns job, plus the city map.

### The plan, in order (each step ships on its own)

**Nov 27: the front door**

1. **Landing section instead of the pop-up.**
   - A tall, calm top section with the tagline ("Get the read before you drive", a nod to a caddy's read), one sentence and a golf illustration (drawn in SVG, so there's no photo licensing).
   - "Find a place" scrolls to the list.
   - The welcome pop-up is removed. Its content becomes a **How it works** page.
2. **Navigation.**
   - The header gets a menu: Places, Map, How it works, My log (signed in), and Sign in / Sign up.
   - It collapses to a menu button on phones.
3. **Sign in only when it's needed.**
   - Guests now see the Follow button; tapping it opens a Clerk sign-in pop-up that says why ("Follow places to keep them at the top").
   - Tapping Post opens the form with a choice at the top: "Sign in to keep this in your private log" or "Post as a guest".

**Nov 28: guest reports and clearer cards**

4. **Guest posting (systems).**
   - A `source` column on reports (`account` / `guest`).
   - A `post_guest_report()` RPC that guests can call. It's rate limited by a salted hash of the IP address, read from the request headers in the database, kept 24 hours, and never linked to the report.
   - Limits: one guest report per place every 10 minutes per address, 10 a day, and at most 6 guest reports per place per hour overall.
   - Guests get no practice log or "changed decision" question.
   - The idempotent report id works the same way.
   - Tests: the same live impersonation checks as before, as a guest.
5. **"Reports from" filter.**
   - Everyone / Golfers with accounts / Guests, remembered in the browser.
   - It applies to status, the heat map, the cards, the summary and recent reports. One filtered report list feeds `placeStatus()`, so they can't disagree.
   - Guest reports get a small "Guest" tag in the lists.
   - Tests: status with the filter.
6. **Clearer cards.**
   - Plain names: "Driving range" instead of "Range", "Short game area", "Putting green", "Simulator bays".
   - Each card is grouped into three lines: the hours badge, then what's usable ("Driving range limited · Putting green good"), then a footer that separates **"Golfer report: 5 days ago"** from **"Weather now: 50°F, drizzle"**, each with its own label.
7. **Practice filters on Home.**
   - What do you want to practice: Driving range, Short game, Putting, Simulator. Plus "Open now".
   - A pure function with tests: a place matches if it has that kind of area and it isn't closed.

**Nov 29: patterns job (the systems centerpiece)**

8. **Nightly patterns.**
   - A `pg_cron` job in Supabase rebuilds a `place_patterns` table from all report history: per place, when it tends to be packed or quiet (weekday × part of day), and how each area is usually rated by month.
   - Place pages show "Usually" lines from it, e.g. "Usually packed Sat mornings", "Short game usually limited in November", with how many reports each is based on.
   - The same table stores the AI summary, so every server instance shares one.
   - Tests: run the job's SQL against fixture rows in a rolled-back transaction, like the RLS checks.

**Nov 30: city map, checkpoint, fair prep**

9. **City map** (`/map`).
   - Leaflet + OpenStreetMap. Every place (nine since Nov 27) as a pin colored by their hours badge, with what's usable in the popup and a link to the place.
   - Uses the same filters as Home.
10. **Checkpoint #2** with the three golfers, plus the success numbers.
11. **Fair prep:** a two-minute demo path, the test reports deleted, and the README updated.

**If it runs late, cut in this order:**

1. The map's filters (keep plain pins).
2. Practice filters (keep the "Reports from" filter).
3. The AI summary moving into the patterns table.

Guest posting, the clearer cards and the patterns job stay.

**Moved after the fair:** edit/update past reports (design below), the practice plan, the simulator form, the Playwright two-user test, the weather worker, real facility layouts.

### Added Nov 27–28 (user's call: everything before the fair)

**Done:**
- Steps 1–5 above.
- Practice filters (step 7).
- Plus admins, votes and suggestions:
  - **Admins:** a private list in the database (the user's account, plus Test Admin on the `testing` branch). Every admin action is a function that checks `is_admin()` itself.
  - **Confirmed statuses:** an admin turns what golfers keep reporting into a standing status, ranked above published seasons and below fresh reports.
  - **Admin hours:** they replace a place's published hours.
  - **Hiding:** an admin can hide an abusive report, which is kept, with a reason.
  - **Votes:** up or down, one per golfer, never on your own report. Down by 2+ more than up means the report stops counting.
  - **"Show N hidden reports":** like hidden comments, it reveals reports hidden by votes or by an admin.
  - **Suggestions for admins:** golfers agree on something not yet confirmed; a published season golfers contradict; a confirmed status recent reports disagree with; notes mentioning a different closing time.
  - **Admin page (`/admin`):** every place's suggestions in one list, behind an Admin tab only admins see (with the count). Confirm and End work there; Edit first and hours open the place's admin boxes.

- **Patterns job (Nov 27):** `place_patterns`, rebuilt nightly by pg_cron (10:10 UTC, 4:10 AM Chicago) from all report history: crowd by weekday and part of the day, each area's usual rating by month (3+ reports, 60%+ agreeing; hidden reports left out). Place pages show a Patterns block under What golfers say; admins can rebuild from the Admin page. Checked against fixtures in `supabase/tests/place_patterns.sql` (rolled back).
  - Not done: moving the AI summary into the table. The summary route would need either a server-only secret key or a public write function anyone could call, so it stays cached per server instance (fine at this scale).

**Still to do:** the city map, checkpoint #2, fair prep.

---

# Original plan (Nov 17), kept for reference

## Where v1 stands

**Goals by Dec 1** (from the proposal): 10–12 reports from 3 people, at least 6 not mine, and 3 times someone changed a decision because of a report.

**On Nov 17:** 4 reports from 3 people, 1 changed decision, 0 follows. Check again with:

```sql
select
  (select count(*) from public.reports) as reports,
  (select count(distinct user_id) from public.practice_logs) as posters,
  (select count(*) from public.practice_logs where changed_decision is not null and changed_decision <> 'no') as changed_decisions;
```

**Done, including some v2 items pulled forward:**

- Combined status logic (hours → storm → closures → newest rating → season), with tests.
- Data model, row-level security, and `post_report()` as the only way to post (rate limits, idempotent retries).
- Sign-in plus a guest view, a welcome for first-time visitors, follows, and live updates.
- Place pages: the facility heat map (pulled forward from v2), the hours badge, weather, directions, and recent reports with public notes.
- "What golfers say": a rule-based 30-day summary plus an AI paragraph (Groq, once 3 public notes exist).
- My log: practice log history (pulled forward from v2).

**Not done yet from the proposal:** the practice plan, separate simulator forms, the patterns job, the city map, the weather worker, the Playwright two-user test, and user follow-ups.

## Week 2 (Nov 17–24): real use

In priority order.

1. **Checkpoint #1 with the three golfers.**
   - Ask what they checked before going, whether anything on the site misled them, and what they'd want before driving.
   - Fix what they hit before building anything new.
   - This is the TA's main ask.
2. **A shorter form for simulators** (PGA TOUR Superstore, Five Iron, PARennial).
   - Ask "Could you get a bay?" and "How long was the wait?" instead of area ratings.
   - Small change.
3. **Practice plan from the latest report** (the Bucket List tie-in from A3–A4).
   - On each place page, suggest a plan for what's usable today, e.g. chipping closed → a range-and-putting plan.
   - Rule-based, with tests. Reuse A3–A4's plan format.
4. **Playwright two-user privacy test.**
   - Two signed-in golfers in two browsers: each sees only their own log and follows, both see each other's reports, and a guest can't post.
   - This is the browser-level version of the SQL checks already run.
5. **Free-tier safety.**
   - Supabase pauses projects after 7 days without activity, and Nov 24 is a no-class week: make sure the project is used or check on it.
   - Set usage and spending alerts where the services offer them.
   - The Groq key cutoff is Dec 17, after the fair.
6. **Edit and update your past reports, and show when one was changed.** Two different actions (design below):
   - **Edit** fixes a mistake in the report as it was, e.g. a wrong tap or a typo in the note.
   - **Update** adds what changed later, e.g. "the range reopened" or "it got packed".

## Nov 24 – Dec 1: v2 at the fair

7. **Patterns job (the systems centerpiece).**
   - A nightly scheduled job (Supabase pg_cron or Edge Function + Cron) builds a `place_patterns` table from all report history, not just the last 30 days.
   - Example output: "busy most weekday evenings", "short game usually limited in November".
   - The place page reads it. This is the "background work" the proposal promised.
   - It could also store the AI summaries, so they're shared across server instances.
8. **City map.**
   - Leaflet + OpenStreetMap: the seven places as status pins, with a list/map toggle on the home page.
   - Free, no key.
9. **Checkpoint #2 and measuring the results.**
   - Second conversation with the golfers.
   - Run the query above.
   - Write up what changed decisions and what didn't.
10. **Fair prep.**
   - A two-minute demo path: Home → a place's heat map → post a report → it appears live in a second window → My log.
   - Real data only.

## Design: editing vs updating a report

They need to be different, because **status is computed from when a report was made**. "Range good, reported 2 h ago" is only true if the rating describes the range 2 hours ago.

**Edit: "I got it wrong."**
- Fixes the report as it was: a wrong tap, a typo in the public note.
- The report keeps its original time, since it still describes that visit.
- Only the person who posted it can edit it (checked through their practice log, since reports carry no user id), and only for a short window, e.g. 30 minutes or the same golf day. After that the record stands, so history can't be rewritten.
- Shown as **"edited"** next to the time, with what changed available (for example "was: limited").
- Previous versions are kept in a `report_revisions` table, so "reports are never lost" still holds.

**Update: "Things changed."**
- New information at a new time: "range reopened at 3", "it got packed after work".
- Saved as a **new report linked to the original** (`updates_report_id`), with its own time, so the status logic treats it as the fresh information it is.
- Shown in the recent reports as **"Update · 3 PM"** under the original.
- Allowed during the same visit (same place, same golf day). It counts against the per-place rate limit, or gets its own smaller limit.

**Private notes in My log** are different again: they're only yours and affect nothing else, so they can be edited any time, with no "edited" label needed.

**Systems work this involves:**
- an `edit_report()` RPC with the ownership and time-window checks
- the `report_revisions` table
- an `edited_at` column
- the `updates_report_id` link
- listening for Realtime UPDATE events as well as INSERTs
- status tests for "an edit keeps the report's time; an update is newer"
- AI summaries refresh automatically, because their cache key is the report text

## If time runs short (cut in this order)

1. **Weather worker** (a scheduled function that stores weather in a table). Today's cached on-demand fetch works; this mostly checks a proposal box.
2. **Real layouts for the facility sketches** (Harborside first).
3. **The city map** (the facility heat map already covers the "map" idea).

## Known small gaps (from the v1 systems review)

- The AI summary cache is per server instance, so a cold start can call Groq again for the same reports. Fine at this scale; the patterns table would fix it.
- One Supabase performance advisor warning about RLS policies re-evaluating auth is a false positive: the policies already use the recommended `(select auth.jwt() ->> 'sub')` form.
- The proposal lists the Vercel CLI and `gh`, which aren't installed. Install them or update the page.
