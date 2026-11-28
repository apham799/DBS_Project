# Fair demo (about two minutes)

The story: **published hours say a place is open; Range Report says whether the part you need is**, from golfers who were just there.

## Set up before people arrive

- [ ] Latest `main` pushed, and the live site checked: https://range-report-eight.vercel.app
- [ ] **Laptop** (the main screen): signed in with your admin account. Open the Home page, then the Diversey and Harborside pages in tabs.
- [ ] **Phone** (the "second golfer"): open Diversey's page, signed out (a guest is fine). Leave it face up next to the laptop.
- [ ] On both: "Reports from" set to **Everyone**; on the laptop, Diversey's **Patterns** opened once (it stays open).
- [ ] Both charged, brightness up, auto-lock off on the phone.
- [ ] A backup in case the Wi-Fi fails: a screen recording of this path, plus a few screenshots.
- [ ] A QR code to the site on the table, so people can try it on their own phones.

Diversey is the place to post at: it's open until 9 PM, so a new report shows on its map straight away. Harborside is the place to show what an admin can do.

## The path

**0:00 Home** (laptop)
- "Get the read before you drive." The pill in the banner is Chicago's weather right now, and the banner's sky follows it.
- **Find a place** → the cards. Each one says whether it's open (green, yellow within the hour, red). Open one card's **Details**: what golfers say about each area, when the last report came in, the weather.
- Tap **Indoor** in the filters: only the domes and simulator bays stay. Tap **Any** again.

**0:20 Map** (menu → Map)
- Every place as a pin, the same colors. Click a Lincoln Park pin: it zooms in and opens the place's card. **Show all** to zoom back out.

**0:35 A place page** (Diversey)
- The sketch of the facility: each area filled by what golfers reported, outlined by how sure we are (solid = today, dashed = this week, dotted = the published season). Click an area: its latest rating and how it's been rated over 30 days.
- **What golfers say**: the counts, the AI-written summary of golfers' notes, and **Patterns**: "built every night by a job inside the database, from all of a place's reports."

**1:00 Post a report, and watch it arrive** (laptop, then phone)
- **Post a report** on Diversey: three taps (open, the range, how busy), plus a note. Post.
- Point at the phone: **the report shows up on its own, no reload.** The map changes color on both screens.

**1:25 My Log** (laptop, menu → My Log)
- The same post, with the private notes only you see: "this is why golfers bother posting."

**1:40 Admins** (laptop, Harborside, then the Admin tab)
- Harborside is lined with **stars**: an admin set it closed for the season, and the note says why (click an area, or see Published info).
- The **Admin** tab: suggestions the app makes from golfers' reports ("golfers say limited, not what the published season says"), confirmed with one click.
- Back on Diversey, **Hide (admin)** the demo report, reason "Fair demo". On the phone it folds into "Show 1 hidden report", like a hidden comment. (This also keeps the demo report out of the real data.)

**2:00** Done. If they're still interested: **Reports from** (golfers with accounts vs guests), voting a report up or down, the time filter on Recent reports.

## If someone asks

- **How do you know it's right?** Each area's status is the newest rating, and it ages: "reported" for a day, then "probably still" for a week. Ratings that disagree are flagged. Golfers vote reports up or down (2 more downs than ups hides one), and admins can hide reports or confirm a status.
- **Do I need an account?** No. Guests can post (marked "Guest", and you can filter them out). An account adds the private practice log and following places.
- **Is my data private?** Reports carry no user id at all; the only link to you is your own private log, which only you can read (row-level security).
- **What's the "systems" part?** Postgres row-level security and two posting functions as the only way in, rate limits (per person, per guest device, per place), live updates over Realtime, a nightly `pg_cron` job building the patterns, and status logic that's all pure, tested functions.
- **Where does the weather come from?** Open-Meteo, one shared call cached for 15 minutes; a thunderstorm marks outdoor areas probably closed.
