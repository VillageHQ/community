# Verification: jobs on cards, profiles, directory and Today

Independent verifier, 2026-11-11, branch `absi-agent/jobs-on-cards` (head 7e0b05e). Code not edited.
Setup: `next dev` against my own databases `verify_demo` (DEMO_MODE=true, port 55723) and `verify_plain`
(no demo, `JOB_FEEDS_FAKE_ORIGIN=http://127.0.0.1:55725`, port 55724), plus a fake Greenhouse feed in
`.ai/tmp/verify-fake-feed.mjs`: `/greenhouse/ok*` serves `src/test/fixtures/jobs/greenhouse-stripe.json` as-is, and
`/greenhouse/okfresh*` serves the same file with `first_published` set to now and new ids. Made-up accounts only
(`vera.tester@example.com` admin from /setup, `fern.founder@example.com` founder from an admin invite link; no email sent).
Checked at 390 px and 1280 px wide. Servers stopped and databases dropped afterwards. Screenshots are in `reports/verify/`.

| # | Check | Result |
|---|-------|--------|
| A1 | Demo Today shows "New jobs this week" with jobs | PASS |
| A2 | Directory chips "Hiring · N jobs" | PASS |
| A3 | "Hiring now" narrows the list and toggles off | PASS |
| A4 | Profiles list jobs, Apply is an http(s) link with target=_blank | PASS |
| A5 | Sam's card page shows the jobs section | PASS |
| A6 | Job board off: nothing shows, `?hiring=1` lists everyone | PASS |
| B1 | Link from the card on a non-demo server: jobs appear (card count, profile, chip) | PASS |
| B2 | Today card with the fixture's own dates | PASS (stays hidden: the fixture's jobs are from Sept 2026) |
| B3 | Today card with recent jobs (okfresh feed) | PASS |
| B4 | Second link of the same careers link is refused | PASS |
| C1 | Empty company on the card: form says to add the company first | PASS |
| C2 | Very long job title at 390 px | PASS |
| C3 | Exactly 5 jobs: no "See all"; 6 jobs: "See all 6 jobs" | PASS |
| C4 | Hidden source disappears from profile, chip, filter and Today | PASS |
| C5 | Stale `?hiring=1` with the board off | PASS (ignored), see minor note 1 |

## A. Demo mode (made-up community, signed in as Sam, then Maya)
- **A1 PASS**: Today shows "New jobs this week · 4 new jobs at the community's companies": Stackwise, Tallyhealth,
  Ledgerline and Kilnworks, each with a logo, a place, a new-tab icon and "See all jobs on the board". No sideways
  scroll at either width (`A-today-card-390/1280.png`).
- **A2 PASS**: The directory shows chips on Amara Diallo (Kilnworks, 2), Grace Kim and Priya Shah (Ledgerline, 3),
  Ravi Menon (Stackwise, 5) and Sam Lee (Tallyhealth, 4). Members without jobs have no chip (`A-directory-1280.png`, `A-directory-chip-390.png`).
- **A3 PASS**: "Hiring now" (aria-pressed false to true) changes the URL to `?hiring=1` and the count from 20 to 5
  matching members, all with chips. Pressing it again goes back to `/members` and 20 (`A-directory-hiring-*.png`).
  With the dev server, the list takes about a second to update after the URL changes.
- **A4 PASS**: Ravi Menon shows "Open jobs at Stackwise" with 5 jobs. Priya Shah shows Ledgerline with 3 jobs. Every
  Apply link is `https://<company>.example.com/careers/...` with `target=_blank` and `rel="noopener noreferrer"`, and
  has screen-reader text "for <title> at <company> (opens in a new tab)". At 390 px the Apply buttons are full width (`A-profile-*.png`).
- **A5 PASS**: Sam's /members/card shows "Your company's jobs · Tallyhealth · Ashby · 4 open jobs · Manage or link
  another" linking to /jobs/yours (`A-card-jobs-*.png`).
- **A6 PASS**: As Maya, /admin/features › Jobs › "Turn off Jobs" (confirmation dialog). Then as both Maya and Sam, at
  both widths: no Today card, 0 chips, no "Hiring now" button, `/members?hiring=1` says "20 members match" (same as
  `/members`), Ravi's profile has no job list, and the card page has no jobs section. A direct
  `POST /api/members/directory` with `hiring:true` also returns everyone (`A-off-*.png`).

## B. Linking from the card against the fake feed (no demo)
- /setup with the SETUP_TOKEN created admin Vera. I turned on Jobs in features (it was off by default), saved
  company "Stripe Example" on the card, and pasted `https://boards.greenhouse.io/ok-stripe` in the card's jobs
  section, then clicked "Link our hiring tool".
- **B1 PASS**: The section changed straight away to "Stripe Example · Greenhouse · 3 open jobs · Manage or link another"
  (`B-card-linked-*.png`). Profile: "Open jobs at Stripe Example" with 3 "Abuse Investigator" jobs, Apply links to
  `https://stripe.com/jobs/search?gh_jid=…` with target=_blank (`B-profile-*.png`). Directory: "Hiring · 3 jobs", and
  the "Hiring now" filter is shown.
- **B2 PASS**: The Today card stays hidden. In the database `posted_at` is 2026-09-03 and 2026-09-09
  (`first_published`), which is older than 7 days, and `first_seen_at` is now. Posted dates take priority, as specified.
- **B3 PASS**: Linking a second source, `okfresh-stripe` (posted now), made Today show "3 new jobs" with only the
  fresh ones (`B-today-fresh-1280.png`). The chip became 6, and the profile showed 5 jobs plus "See all 6 jobs" →
  `/jobs?company=stripe-example`, a board with 6 Apply links.
- **B4 PASS**: Linking `ok-stripe` again on /jobs/yours shows "This careers link is already on the board, for Stripe
  Example." The invited founder Fern ("Fernworks Example") got the same refusal for `ok-stripe` on the card page.
  Fern's own link (`okfern`) worked (`B-card-founder-linked-*.png`), and the directory then had 2 hiring members (`B-directory-founder-hiring-1280.png`).

## C. Trying to break it
- **C1 PASS**: Founder Fern (not an admin) with an empty company sees on the card page: "Add your company to your card
  first. Then you can share its jobs here." (`C-card-nocompany-founder-*.png`). After saving a company, the form shows it
  read-only ("From your card"). An admin with an empty company instead gets an editable Company field, by design (`C-card-nocompany-before-1280.png`).
- **C2 PASS**: A 197-character title with long unbroken words, and a long location, added by hand. At 390 px it wraps
  inside the profile card and the Today card, with no sideways scroll (scrollWidth 375) (`C-profile-longtitle-5jobs-390.png`, `C-today-longtitle-390.png`).
- **C3 PASS**: Demo Tallyhealth went from 4 jobs to 5 (by hand): the profile shows 5 jobs and no "See all". At 6 jobs:
  5 rows and "See all 6 jobs" → `/jobs?company=tallyhealth` (`C-profile-6jobs-seeall-*.png`). Stackwise, which has
  exactly 5 seeded jobs, also has no "See all". The plain server showed the same with 6 jobs from two sources.
- **C4 PASS**: Hide on /jobs/yours. In demo, Sam's Tallyhealth: the profile list is gone, the hiring filter went from 5 to 4 matching
  members with no Tallyhealth chip, and Today dropped its Tallyhealth jobs (3 new jobs). The card section says
  "Ashby · 6 open jobs · hidden" (`C-card-hidden-1280.png`). On the plain server, hiding the fresh source hid the Today card, the chip went
  from 6 to 3, and the profile showed 3 jobs and no "See all".
- **C5 PASS**: With the board off, `?hiring=1` lists everyone (A6).

## Minor problems found (not blocking)
1. **A stale `hiring=1` stays in the URL while the board is off.** Steps: turn Jobs off, open `/members?hiring=1`,
   click the "Sales" tag chip. The URL becomes `/members?tag=sales&hiring=1`. The filter is ignored and invisible, so
   nothing is wrong today. But a bookmarked or shared link narrows silently to hiring members once the board is
   turned back on, even though no button could remove it while the board was off.
2. **The card page's "add your company" message links to the page it is on.** Steps: as a non-admin founder with an
   empty company, open /members/card. The jobs section says "Add your company to **your card** first", and the link goes to
   `/members/card`, which is the page you are on, just above. It works, but reloading the same page is odd. Plain text, or
   a link to the Company field, would read better. The intro line above it ("Paste your careers link and…") also shows next to a form you cannot use yet.
3. **Cosmetic, Today card:** a long location wraps onto its own line starting with "· " under the company name
   (`C-today-longtitle-390.png`).
4. **Possible naming confusion:** in demo the directory has both the "Hiring now" filter chip and a "Hiring" tag chip
   next to each other. The divider sets them apart, but they mean different things.

Environment note (not the app): the dev server compiled `/api/admin/modules` on first use and the first Jobs toggle
was lost while it compiled (one `asks/counts` 500 from a database connection timeout during the compile). The second try
worked. I saw nothing like this after warm-up.

## Re-check after the repair (builder, demo mode)
Only what the verifier flagged and what changed:
- Stale `hiring=1` with the board off: clicking the "Sales" tag goes to `/members?tag=sales`; the stale parameter is dropped. PASS.
- A founder with no company on the card: the jobs section says "Add your company to your card above and save. Then paste your careers link here…" and shows no form, with no link back to the same page (`recheck-card-no-company-390.png`). PASS.
- Today, a long location: "Kilnworks · <location>" wraps as one line of text, with no orphan "· " (`recheck-today-long-location-390.png`). PASS.
- The "Hiring now" chip sits next to a "Hiring" tag: this was already handled before verification. The filter is named "Hiring now", has an icon and a divider before the tags.
