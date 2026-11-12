# Independent check: fix-feed-digest-site

Checker: a separate session that built nothing. Date 2026-11-12. App: production build, demo mode, http://127.0.0.1:56620
(cm_demo); a second run on a fresh cm_main with demo off. Static site: `python -m http.server 56630` in `site/`.
Made-up people only (demo members, plus `checker-admin@example.com` on cm_main). Nothing left the machine.

| Row | Result | What I did | Screenshots |
|---|---|---|---|
| FEED-01 | PASS | Sam: the Feed menu item opens /feed (200, no redirect to Today). Non-demo cm_main, demo off, fresh setup: Feed switch on with nothing stored, Feed in the menu, /feed 200 with "Post a welcome". Maya turned Feed off in Features (asks to confirm): /feed 404, POST /api/feed/posts 404, no /feed links left. Turned it back on: /feed 200. | feed01-open-1280/390, feed01-mobile-footer-link-390, feed-default-nondemo-menu/feed/features-1280, feed-features-off-confirm-1280, feed-off-404-1280 |
| FEED-02 | PASS | Sam posted plain, Ask, Win and Offer posts (each shows its badge); posted from the 390 bottom sheet too. Empty or blank post: "Write your post first." (422, nothing saved). A post with `<script>` / `<b>` shows as plain text; the URL becomes a link. | feed01-open-1280, feed06-compose-390 |
| FEED-03 | PASS | Replied to his own post with the send button; the reply shows. Added a Rocket reaction (count 1). Edited his own reply and then deleted it ("Delete this reply? It's gone for good."), both kept after reload. | feed02-reply-react-1280 |
| FEED-04 | PASS | Sam edited his own Win post ("· edited", kept after reload) and deleted his Offer post after the inline confirm ("Post deleted."). On others' posts and replies his menu shows only "Report". Direct API calls: edit and delete of Amara's post give 403 "You can only change what you wrote."; pin gives 403 "Only an admin can do this." | feed03-edit-1280, feed04-delete-confirm-1280 |
| FEED-05 | PASS | Maya pinned Sam's post ("Pin to the top"); it moved to the top as "Pinned by Maya Ortiz", 1280 and 390. Unpinned it; it went back. | feed04-pinned-admin-1280/390 |
| FEED-06 | PASS | Sam reported Amara's post and Priya's reply (inline confirm, "Report sent to this community's admins."). Reporting the same post again: "You already reported this. It's waiting for an admin." Both show in Admin › Reports (Open 2) with Dismiss / Delete / Remove. | feed05-report-1280, feed05-admin-reports-1280/390 |
| TODAY-06 | PASS | Signed out, opened RIGHT, HIDE and FIX links for Sam's fact item 4 (City: New York): headings "Is this right?" / "Hide this line?" / "Fix this line", lede "We filled this in from public sources. You decide what shows." A YES link on that fact says "This link doesn't work". FIX with an empty field: the browser blocks it; with the check bypassed (spaces sent) the server says "Write the right words for this line." and saves nothing (no action row, location unchanged). FIX "Brooklyn, New York" saved once (member_profile.location, confirmed_at, one weekly_email_action). Pressing again, or opening HIDE for the same item: "Already answered". Priya's items (added by me, see below): RIGHT set confirmed_at once, HIDE set hidden_at once, RIGHT on the hidden item said "Already answered". `weekly-email.test.ts`: 29/29 pass, including RIGHT/HIDE/FIX by reply. | today06-right/hide/fix/yes-link-1280/390, today06-fix-empty-390, today06-already-390 |
| TODAY-05 | PASS | After each button the page changes to "Done" plus what happened: RIGHT on 127.0.0.1 ("Thank you. It's marked as right."), HIDE on localhost:56620 ("Hidden. It stays hidden when your profile refreshes."), FIX on 127.0.0.1 and localhost ("Saved in your own words. They always win."). The 303 goes to a relative `/weekly?...&result=done` on the same host. Unsubscribe page (/unsubscribe?token=…) on 127.0.0.1 (390) and localhost (1280): after Unsubscribe it shows "You're unsubscribed" and writes email_opt_out. | today05-right-before/done-1280, today05-hide-before/done-localhost-390, today05-fix-done-390, today05-fix-done-localhost-1280, today05-unsub-before/after-390/1280 |
| PROF-15 | PASS | Amara's profile has "Open jobs at Kilnworks" (1 job, Apply). Sam's own /people/<id> has "Open jobs at Tallyhealth" (2). Directory cards: Amara "Hiring · 1 open job", Sam and Priya "Hiring · 2 open jobs"; Marcus, Ada, Diego and the rest say nothing about jobs, and Marcus's profile has no jobs block. The card matches Founderhall's directory card crop. | prof15-directory-1280/390, prof15-amara/sam-own/marcus-profile-1280/390 |
| SITE-02 | PASS (one look issue) | Pricing section: Self-host Free (AGPL-3.0), Managed $1,000/month billed yearly ($1,200 month-to-month), Managed Growth $2,500/month ($3,000), in Founderhall's table. Light and dark, 390 and 1280. At 390 the price breaks inside the word: "$1,000/mont h". | site02-pricing-light/dark-1280/390, site-full-light-1280.jpg |
| SITE-03 | PASS | Empty submit: all four Founderhall messages, aria-invalid, focus on name. Blank name, "leila@nodomain", 12.5 and -3 members are refused. Price line: 500 gives "From $1,000/mo"; 501 and 2,500 give "From $2,500/mo (Managed Growth, up to 2,000 members)". The button says "Send me the install guide" for self-host. Valid submit: "Thanks, Leila. Nothing was sent." with zero network requests (I watched every request). The page only loads from 127.0.0.1:56630. HTML in the name is shown as text. Filled honeypot: "Request received.", nothing sent. With JavaScript off the form is hidden and the page says "The sign-up form needs JavaScript. You can still run it yourself." | site03-form-light/dark-1280/390, site03-errors-light-1280, site03-errors-dark-1280/390, site03-submitted-light-1280, site03-nojs-390 |

## Broken or wrong
1. **Site, 390 px: the price breaks inside the word** (SITE-02, cosmetic). Serve `site/`, open it at 390 px wide, scroll
   to Pricing: the Managed and Managed Growth prices read "$1,000/mont h" and "$2,500/mont h". Founderhall's
   SITE-03-pricing-390 keeps "$1,000/month" on one line. Screenshot: site02-pricing-light-390.png.
2. **The site's price line stops at Managed Growth above 2,000 members** (SITE-03, minor). Type 2500 in Members: it
   still says "From $2,500/mo (Managed Growth, up to 2,000 members)". There is no "talk to us" hint for a number
   above the plan's limit.
3. **The Hiring line follows the card's company text, not who owns the job source** (PROF-15, edge case). Priya owns
   the Ledgerline job source. Change her company line (for example a weekly FIX to "Ledgerline Ltd") and her card
   loses "Hiring · 2 open jobs", while Grace Kim (VP Engineering, Ledgerline) keeps it. Reasonable, but a founder who
   renames her company line loses her own Hiring line.
4. **A stale note after an empty post** (FEED-02, minor). Post something ("Your post is live."), then press Post with
   an empty box: "Write your post first." shows while "Your post is live." is still above the box.
5. **On a phone the Feed is hard to find** (FEED-01, minor). At 390 the bottom bar has Today, Asks, Search,
   Directory, Intros and Inbox. Feed is only a small "Feed" text link at the very bottom of each page
   (feed01-mobile-footer-link-390.png). The bar matches Founderhall's and the link works, so this is not a failure.
6. Copy, outside this build's changes: the unsubscribe page reads "Stop emails about weekly email?" / "We won't email
   you about weekly email anymore." The Reports page says "nobody is told who reported" just above "Reported by Sam Lee"
   (it means the author isn't told, but it reads as if it contradicts itself).

## Tried to break
- Feed: empty and blank posts, `<script>` and `<b>` in a post, editing, deleting and pinning others' posts through
  direct API calls (403), reporting the same post twice, switching the feed off (page and API 404, menu link gone)
  and on again, the 390 bottom sheet, dark mode.
- Weekly links: a valid token with the wrong action (YES on a fact), `&result=done` added to an unanswered link
  (still shows the question, not a false "Done"), FIX with the browser's required check removed, a second press,
  another action on an answered item, two POSTs at once (one action row), the browser's Back button after Done,
  127.0.0.1 and localhost, signed out. Lines that are no longer on the card return "This isn't available anymore" and
  write no claim.
- Unsubscribe: on both hosts. Opening the link again after unsubscribing shows the done state with no button.
- Site: every field invalid, decimals and negative member counts, the 500/501/2,500 member boundaries, HTML in the
  name, the honeypot, JavaScript off, network watched on load and on submit.

## Test data I changed (throwaway cm_demo; the demo resets nightly)
- To get fresh fact items I added items 2–4 (title, location, company) to Priya's queued weekly email and, for the
  test, cleared her own title, location and company so her card used the filled-in lines. Afterwards I restored her
  profile (Founder & CEO, London, Ledgerline) and her fill-in flags. The weekly_email_action rows stay.
- Sam's location is now "Brooklyn, New York" (from the FIX test). My test posts ("CHECK …", a `<script>` text post) and
  two open reports are still in the feed.
- cm_main now has the admin `checker-admin@example.com`.
- The demo app was stopped for the cm_main run, then restarted with `.ai/tmp/start-demo.sh`; it is running again on
  56620. The site server is stopped and the browser is closed.
