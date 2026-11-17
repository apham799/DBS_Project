# Range Report: plan for v2 (fair on Dec 1, 2026)

Written Nov 17, 2026, the day v1 shipped. Based on the project proposal's roadmap, the TA's feedback ("less, done well"; check in with users at checkpoints) and a classmate's (a heat map of each facility).

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
