# Verification: fix-small (independent)

Branch `absi-agent/fix-small`, run on 2026-11-10 against `next dev` on port 55643 using the demo database `app` (made-up data only). Screenshots are in `reports/verify/`.

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | Sign-in keeps the typed email | PASS | Email-on mode (DEMO_MODE=false, fake Resend). At 390 px I typed `river.test@example.com` in the link form and switched to the password form: the email was still there. I edited it in the password form and switched back: the edited value stayed. A wrong password ("Invalid email or password") also kept it. `1-link-form-typed-390.png`, `1-password-form-keeps-email-390.png`, `1-link-form-back-390.png` |
| 2 | Switched-off page answers 404 | PASS | Perks and Asks off, admin cookie: `/perks` 404, `/admin/perks` 404, `/asks` 404, `/perks?x=1` 404, `/asks?tab=mine` 404, `/asks/new` 404, `/PERKS` 404, `/perks%2F` 404, RSC request to `/perks` 404. `/perks/` and `/admin/perks/` give 308 to the slash-less path, which then 404s. Signed out: `/perks` and `/asks` 404. Core pages `/` and `/members` 200, `/admin` 200. Turned back on: `/perks`, `/admin/perks` and `/asks` 200. In the browser with both off, sidebar clicks to Members, Intros, Messages, Meet and Home all navigated. `2-perks-off-404-1280.png` shows the app's own "We can't find that page" |
| 3 | Today "Check your card" | PASS | Sam (demo). Shown: the headline (filled yesterday), and a location filled 6d23h ago when his own location is empty. Not shown: the `title` row while his own title is set, `face`, `company_logo`, a hidden location (`hidden_at` set), and a location filled 8 or 9 days ago. When nothing qualifies the card is gone. The "Fix or hide on your card" link opens `/members/card`. `3-today-check-your-card-390.png` |
| 4 | Perks from the menu: full load and its own CSP | PASS | At 1280 px, the sidebar Perks link did a full document load of `/perks`, and the response's CSP includes `frame-src https://builtfirst.com https://*.builtfirst.com` (Today's CSP has no frame-src). At 390 px, Perks is under More: the same full load and CSP. Members (1280) and Intros (More, 390) still navigate inside the app, with no document load. `4-perks-from-more-390.png` |
| 5 | Slack /ask slow-post follow-up | PASS (test + code read; no live Slack) | `pnpm test src/modules/chat`: 24/24 passed, including "answers at once when posting is slow…": with posting delayed by 400 ms and a 50 ms reply window, the reply is `SLACK_POSTING_NOTE` and one ephemeral "Posted to…" goes to response_url. Code: a late rejection is caught in `sendLateAnswer` and sends `SLACK_POSTING_FAILED`; a RequestError is returned as text and followed up. `respond()` refuses any response_url not starting with `${SLACK_RESPONSE_BASE}/` (default `https://hooks.slack.com/`), and it runs only after the Slack signature check. Gap: no automated test covers the failure follow-up or the refused URL |
| 6 | Word matching | PASS, with new false matches (see problem B) | Real run in demo: Maya posted asks, and Sam's Today "You said you can help with…" line changed with his can-help-with text. `fund-raising` matched "Fundraising for our seed", `fundraising` matched "Polishing our fund-raising deck", `hiring` matched "Looking to hire a CFO", `raising` matched "We raised a bridge round", `fundraise` matched both fundraising asks. Each of these returned no match on origin/main |
| 7 | Single invite cohort | PASS | Admin → Members form has "Cohort (optional)" with maxlength 80. UI invite with "Fund II 2026" stored `invite.cohort = 'Fund II 2026'`. Empty field stored NULL, and so did API `""` and `"   "`. API 80 chars returned 201 and stored 80 chars. API 81 chars returned **422** "Keep the cohort under 80 characters.". The form clears after "Invite created.". Acceptance copies `invite.cohort` to `member_profile`. `7-invite-cohort-390.png`, `7-invite-created-390.png` |
| 8 | Phone layout and long fund name | PASS | At 360 px the search box shows "A buyer at a hospital …" (CSS ellipsis); at 390 px "A buyer at a hospital gro…". Top bar at 360 and 390 px: one line ending in "…" (title tooltip has the full name). Sidebar at 1280 px: clamped to 3 lines ending in "…". `scrollWidth == clientWidth` on `/`, `/members`, `/members/card`, `/intros`, `/asks`, `/perks`, `/messages`, `/network` and all 13 admin pages and steps, at 360, 390 and 1280 px. `8-today-360.png`, `8-today-390.png`, `8-today-1280.png` |
| 9 | Roadmap | PASS, with one gap (problem C) | `gh pr view` shows #20 through #26 all MERGED. All of them are marked done: #20, #22, #23, #24, #25 and #26 have done lines, and #21 already was. The parity rows are updated, fix-intros and fix-ops are listed as in flight, and a new "From the final check" section lists the follow-ups |

## Problems found

**A. Pre-existing on main, not caused by this branch:** the "Invite someone" link on Admin → Members goes nowhere.
- Repro: open `/admin/members` as Maya. The link's href is `#function() { throw new Error("Attempted to call INVITE_SECTION_ID() from the server…`.
- Cause: `src/app/(app)/admin/members/page.tsx:52`, a server component, imports `INVITE_SECTION_ID` from the `"use client"` file `invite-manager.tsx`.
- The roadmap now lists this, so no fix is needed in this pull request.

**B. Word matching: the dictionary-free stemming adds false matches.** Each of these is a match now and was none on origin/main. Checked with `findMatchedWords(ask, readWords(helper))`, script at `.ai/tmp/words.mts`:

| Helper's words | Ask | Wrongly matched word |
|---|---|---|
| car insurance | who can care for our patients | car |
| unit economics | intro to United Airlines | unit |
| state law | share our stats dashboard | state |
| plans | aircraft planes buyer | plans |
| coding | cod fishing supply chain | coding |
| wire transfers | wired | wire |
| public markets | help with marketing | markets (borderline) |
| account management | find an accounting firm | account (borderline) |

These are low-harm (a helper sees one stray ask), but worth a decision.

**B2. Cosmetic:** a hyphenated helper word repeats itself in the reason.
- Repro: set Sam's can-help-with to `fund-raising`, then post the ask "Polishing our fund-raising deck" as another member.
- Sam's Today reads "You said you can help with fund, raising, fund-raising".

**C. Roadmap gap:** one item from "Still missing or broken" in `cm-results-v2.md` is in neither the new section nor the fix-intros list.
- Item 9 / C6: the connector's "email them for me" option disappears after the first view, and comes back only behind "Make a new link".
- Unless fix-intros covers it, add it.
- The other items are covered: D2 (reply to a DM by email) by the existing reply-by-email item, the rest by the new section, fix-intros or fix-ops.

**D. Minor visual, not from this branch:** with the long fund name, the footer wraps so the "·" separator starts the second line at 390 px, in front of "Source code (AGPL-3.0)". See the bottom of `4-perks-from-more-390.png` and `1-link-form-back-390.png`.

## Housekeeping
- Both dev servers I started on 55643 (demo mode, then email-on) are stopped. Nothing listens on 55643. The browser is closed.
- Demo data is put back:
  - Sam's profile values are restored.
  - My extra `member_fill_in` rows, `verify.cohort*` invites and 4 test asks are deleted.
  - perks and asks modules are set back to `off`, as they were when I started.
- No tracked file was changed. Scratch is in `.ai/tmp/`.

## Re-check after the repair (builder, covers only what failed)
- B (false matches): `care/car`, `planes/plans`, `state/stats` and `feed/fees` no longer match; `coding/code`, `building`, `hiring/hire`, `raised/raising`, `markets/marketing` still do (`src/platform/weekly-email/weekly-email-rules.test.ts`, 12/12). `united/unit` still matches: an "-ed" word stands for its root, as `marketing/market` needs.
- B2 (repeated words): "Polishing our fund-raising deck" for a helper with "fund-raising" now gives the reason "fund-raising" alone (same test file).
- C: the connector's "email them for me" follow-up is now on the roadmap.
- Slack: a follow-up to an address outside Slack's is refused (`src/modules/chat/chat.test.ts`, 25/25).
