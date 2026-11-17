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

## Nov 24 – Dec 1: v2 at the fair

6. **Patterns job (the systems centerpiece).**
   - A nightly scheduled job (Supabase pg_cron or Edge Function + Cron) builds a `place_patterns` table from all report history, not just the last 30 days.
   - Example output: "busy most weekday evenings", "short game usually limited in November".
   - The place page reads it. This is the "background work" the proposal promised.
   - It could also store the AI summaries, so they're shared across server instances.
7. **City map.**
   - Leaflet + OpenStreetMap: the seven places as status pins, with a list/map toggle on the home page.
   - Free, no key.
8. **Checkpoint #2 and measuring the results.**
   - Second conversation with the golfers.
   - Run the query above.
   - Write up what changed decisions and what didn't.
9. **Fair prep.**
   - A two-minute demo path: Home → a place's heat map → post a report → it appears live in a second window → My log.
   - Real data only.

## If time runs short (cut in this order)

1. **Weather worker** (a scheduled function that stores weather in a table). Today's cached on-demand fetch works; this mostly checks a proposal box.
2. **Real layouts for the facility sketches** (Harborside first).
3. **The city map** (the facility heat map already covers the "map" idea).

## Known small gaps (from the v1 systems review)

- The AI summary cache is per server instance, so a cold start can call Groq again for the same reports. Fine at this scale; the patterns table would fix it.
- One Supabase performance advisor warning about RLS policies re-evaluating auth is a false positive: the policies already use the recommended `(select auth.jwt() ->> 'sub')` form.
- The proposal lists the Vercel CLI and `gh`, which aren't installed. Install them or update the page.
