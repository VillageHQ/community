# Independent check: fix-cleanup (commit 88941db)

Production build (`next start`), DEMO_MODE, database `verify1` on `cleanup-test-pg`. Port **3141**, not 3131:
3131 was already taken by an unrelated process (`absi-brain` bun server, PID 62280), which I left alone.
Browser: Playwright, Maya in one context and Omar/Sam in a second one.

| Item | Result | What I saw | Screenshots |
|---|---|---|---|
| A. Cohort on Admin › Invites | PASS | The sheet has "Cohort (optional)" (maxlength 80). Pasted `Lena Park, lena.park@example.com` + `omar.diaz@example.com`, cohort `Fall 2025` → "2 invited."; DB: both invites have cohort `Fall 2025`. Demo mail is blanked (`skipped`), so I set a known token on Omar's invite by SQL, opened `/invite?token=…`, accepted and finished onboarding: his directory card shows the **Fall 2025** chip. API: 81 chars → **422 "Keep the cohort under 80 characters."**; 80 chars → 200 and stored. | A-invites-sent-1280, A-omar-card-fall2025 |
| B. Revoke wording + "Sent …" line | PASS | Revoke → "Yes, revoke" → status "Invite revoked. Its link no longer works."; the row shows a "Revoked" pill and "Sent 12 Nov, revoked 12 Nov". At 1034 / 1280 / 390 / 320 px every "Sent …" line has white-space normal and is never cut off (scrollWidth ≤ clientWidth). At 1034 it wraps to 2 lines. | B-revoked-1034, B-revoked-1280, B-revoked-390 |
| C. Hiring follows who linked the jobs | PASS | Sam owns the Tallyhealth job source. As Sam, My profile › Company changed to "Tally Health Labs International Holdings (a very long renamed company name)". As Maya: the directory card still says "Hiring · 2 open jobs", `/directory?hiring=1` still lists Sam, and `/people/<sam>` still shows both jobs. | C-directory-hiring-after-rename, C-profile-jobs-after-rename |
| D. Feed note | PASS | Post → sr-only `role=status` "Your post is live." (in the accessibility tree). Empty box + Post → visible alert "Write your post first."; "Your post is live." is gone from the DOM and the accessibility tree. | D-feed-empty-error-1280 |
| D. Feed tab | PASS | 390 px: Sam has 7 tabs (Today, Asks, Feed, Search, Directory, Intros, Inbox), 11 px; Maya has 8 (+ Console), `data-count=8`, 10 px. Feed has `aria-current=page` on /feed. getBoundingClientRect: no label clipped, overlapping or outside its column at 390 or 320 px. Equal columns with the top marker, like Founderhall's reference bar (Founderhall has 6 tabs; the 7th/8th are by spec). At 320 px the Directory column is 2–3 px wider than the others (min-content); labels still fit. | D-sam-tabbar-390, D-sam-tabbar-320, D-maya-tabbar-390, D-maya-tabbar-320 |
| E. Connector intro panel | PASS (with one SQL step) | Marcus → via Sam → Rachel. As Sam, "Yes" needs Rachel's email here, so Yes + email emails Rachel straight away. That path already shows "We emailed Rachel on 12 Nov." To reach the private-link state I cleared `consent_email_at` / `target_email` by SQL, then pressed "Make a new link": "Send Rachel this private link…" + "Or let us email Rachel for you". I typed `rachel.kim@example.com` and pressed "Email Rachel". **Within 300 ms** the paragraph read "We emailed Rachel on 12 Nov…", "Send Rachel this private link" was gone and the form was gone. Every date on the connector's intro pages and the intros list is day-first ("12 Nov", "19 Nov"). None was month-first. | E-link-and-email-form-1280, E-after-email-1280, E-connector-after-yes-1280 |
| F. Website plan above 2,000 | PASS | `site/index.html` from disk: 120 → "From $1,000/mo"; 1500 and 2000 → "From $2,500/mo (Managed Growth, up to 2,000 members)"; 2001, 5000, 1e9, 2000.5 → "Priced for your size: above 2,000 members, Village quotes a plan with you". Empty/0/-5 → $1,000. Nothing was published. The only console errors are font CORS errors, caused by opening it from file://. | F-site-5000-1280 |
| G. Fill-in card first on phone | PASS (SQL setup) | Set `fill_in_basis='ask'` and cleared Sam's lookup choice by SQL. At 390 px Today shows "Fill in your card from public profiles?" right under the header, before "2 asks on your paths". Afterwards I put the setting back to `terms`. | G-today-fillin-390 |
| 1. Sign-in keeps email | PASS | I typed an email, then pressed "Sign in with a password": the email was still there. With the email empty, Sign in shows the browser's required prompt ("Please fill out this field."). | (none) |
| 2. Decline with empty note | PASS | Maya asked an intro via Sam; Sam picked "Not this time" with an empty note and pressed Send: "Sam can't make this one"; DB `declined / not_this_time / reason null`. No "Invalid input". | 2-decline-empty-note |
| 5. Module off → 404 | PASS | In Admin › Features I switched off Feed and Jobs (confirm dialog each time). `/feed` and `/jobs` returned **404** for Sam and for Maya (requests with session cookies, and a real browser navigation). With Feed off, the phone bar drops to 6 tabs. I switched both back on → 200. | 5-feed-off-404-390 |
| 6. Perks from the menu | PASS | Clicking Perks in the side menu loads the whole document (a document request, no RSC fetch): 200 with CSP `frame-src https://builtfirst.com https://*.builtfirst.com; frame-ancestors 'none'; …`. | (none) |
| 3/4/7 | Skipped | Covered by tests, as the brief allows. | (none) |

## Problems found (most severe first)

1. **Double-click on Post creates two identical feed posts** (probably older than this build; this build's composer change did not add a guard). Steps: Sam › /feed, type "Double click test post (made up).", double-click Post → `post` table has two rows 12 ms apart. `disabled={createPost.isPending}` comes too late for two clicks in the same frame. Low–medium.
2. **At about 1034 px a revoked invite's name is cut to "Len…"**: the new "Revoked" pill takes the room on the name line (the e-mail lines on all rows are cut with "…" at that width too). The "Sent …" line itself is fine. Steps: /admin/invites at 1034 px, revoke an invite → see B-revoked-1034.jpg. Low (cosmetic).
3. **The CSV route rejects a cohort it ignores**: `POST /api/admin/invites/bulk?format=csv&cohort=<81 chars>` → 422 "Keep the cohort under 80 characters.", although a CSV ignores the list cohort (`format=csv&cohort=Ignored` → 200, stored with no cohort). The sheet never sends a cohort with CSV, so it is API-only. Very low.
4. Notes, not bugs: on a phone the floating "+ Post" button covers part of a post card's header/Reply at 320–390 px (layout from before this build). A cohort made only of spaces is stored as none. A leading "=" is stripped (`=HYPERLINK("x")` → `HYPERLINK("x")`). A second "Email Rachel" in one day is refused with "We email a link at most once a day…".

## Data I changed in `verify1`
Invite token for omar.diaz set by SQL (then accepted); test invites a80@, aspace@, aformula@, acsv@ example.com; Lena's invite revoked;
Sam's company edited in the UI, then set to null by SQL and back to `Tallyhealth`; intro 4272ac1c: `consent_email_at`/`target_email` cleared once;
new intro Maya→Sam (declined); 3 made-up feed posts by Sam; `fill_in_basis` set to `ask`, then back to `terms`; Sam's lookup consent/refusal cleared (it was empty already).

## Cleanup
- Browser closed (both contexts).
- Server stopped: my `next start -p 3141` (PID 66776) was killed and port 3141 no longer answers. The first background shell hit its 10-minute limit, but its node child kept running. I tried a restart, which failed with EADDRINUSE, so I kept using the first server.
- Port 3131 (unrelated absi-brain process) not touched. `cleanup-test-pg` still running.
- `A-join-omar.jpg` shows a 404: I first tried the wrong path `/join?token=…`. The real path is `/invite?token=…`. This is not a bug.

## Round 2 (commit a70edf3, same setup, port 3141)

| Point | Result | What I saw |
|---|---|---|
| 1. One post per double press | PASS | As Sam on /feed: a double-click on Post → 1 row in `post` (the feed table is `post`, not `feed_post`). Two fast Ctrl+Enter → 1 row. Three `click()` calls in the same JS tick → 1 row. Each time a single "Your post is live.". The next post after each one went through normally, so the guard lets go. |
| 2. Pill leads the "Sent …" line | PASS | Revoked (Lena Park) and Expired rows (to get an Expired row I backdated a80@example.com by SQL, then put it back). At 1034, 1280 and 390 px the pill sits at the start of the "Sent …" line, the name "Lena Park" is shown in full, and the line wraps ("Sent 12 / Nov, revoked 12 Nov" at 1034) and is never cut. The expired line reads "Expired · Sent 23 Oct, ended 6 Nov". |
| 3. CSV ignores the list cohort | PASS | `format=csv&cohort=<81 chars>` with `name,email\nRound Two,round2.csv@example.com` → 200, invitedCount 1, stored with no cohort. `format=list&cohort=<81 chars>` → 422 "Keep the cohort under 80 characters." |

Screenshots: round2-invites-1034.png, round2-invites-1280.png, round2-invites-390.png.

New things noticed (minor, older than this build):
- At 1034 px the e-mail lines are still cut with "…". So are the bold names of invites that have no name, where the name line is the e-mail itself (e.g. "aformula@exa…", "a80@example.c…"). The full address is in the accessible name.
- An expired invite stays under "Waiting to sign in" with "Revoke" still offered.

Cleanup: browser closed; my server (PID 40072, `next start -p 3141`) killed, and port 3141 no longer answers; the a80@example.com invite has its dates back as an open invite. `cleanup-test-pg` and port 3131 not touched.
