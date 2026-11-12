# Round 4 verdicts — before the fix pass (2026-11-12)

Six checkers who built nothing retook every Founderhall shot from Community's demo (and a fresh install for the first-run shots) at 1280 and 390 px, put each beside Founderhall's and named each real difference. Community data and the kept calls of each area's pull request are not differences. Pairs: `.ai/tmp/pairs-full/` (not committed); the reviewed set is in `pairs/` after the fix pass.

## g1-today-asks: Foundation shell (area 0) + Today and Asks & updates (area 1)

Capture: `cap-g1-today-asks.mjs` (all 21 shots), `cap-g1b-newmember-emails.mjs` (new member through the invite link and
welcome steps, plus the email words via an outbox copy trigger), `cap-g1c-status.mjs` (status codes, path diagnosis).
Pairs in `pairs/`, page text in `g1-text/`, emails in `g1-mails.json`. Perks set off for the Sam shots, as in
Founderhall's demo, and on for `member-today-with-perks` / `-new-member`.

**Shell findings that apply to every row below (written once, marked "shell"):**
- S1. Fund mark: Community shows the initials tile "NF"; Founderhall shows its logo tile (sidebar and phone top bar). The demo seed sets no fund logo.
- S2. Sidebar menu: every item sits **2 px higher** than Founderhall's (active pill y 121–158 against 123–160 on Today; 163–200 against 165–202 on Asks). The fund mark, the "Members" label, the person block, Sign out and the footer rule line up exactly.
- Matches: 264 px sidebar, menu order and labels, Perks item only while on, person block with Sign out, "Source code (AGPL-3.0)" footer, phone top bar (mark + avatar), 6-tab phone bar. Person avatars use two-letter serif initials when there is no photo ("LF", "SM", like Founderhall's "LF", "NC").
- Not differences: the Intros count badge "1" (kept call, PR #43), "New this week" card and "Report this ask/answer" links (kept calls, PR #50), faces, logos, tints, counts and dates.

**Today-only finding (marked "T1"):** the gap between the eyebrow line ("12 Nov · Sam's week…") and the h1 is **6 px shorter** than Founderhall's. The h1 starts at y 64 against 70 at 1280, and 6 CSS px higher at 390, so everything below it sits 6 px higher. Asks pages line up exactly (h1 at y 44 on both).

| Shot | 1280 | 390 | Differences (each one short and concrete; "—" if none) |
|---|---|---|---|
| member-today-populated | FAIL | FAIL | shell S1, S2; T1. Otherwise the same sections, order, parts and words. |
| member-today-new-member | FAIL | FAIL | shell S1, S2; T1. Community adds an "Almost there · Check your email to confirm it's you · See where things stand" card under the empty state. This comes from the Community next-step cards (a kept call), but see "Broken anywhere": a member who joined from the emailed invite link is still asked to confirm their email. |
| member-today-other-member | FAIL | FAIL | shell S1, S2; T1. |
| member-today-skip-done | FAIL | FAIL | shell S1, S2; T1 (flash, then the eyebrow, then the h1 4–6 px tighter). Flash words match. "Your asks in motion" doesn't list Sam's 40th-clinic post because Community posted it as a real Update (see update-posted). |
| member-today-fact-right-done | FAIL | FAIL | shell S1, S2; T1. Flash "Thank you. Marked as right." and the removed "Is this right?" section match. |
| member-today-with-perks | FAIL | FAIL | shell S1, S2; T1. The Perks rail card and menu item match. |
| member-asks-board | FAIL | FAIL | shell S1, S2 only; the body matches pixel-for-pixel in layout and words. |
| member-asks-compose-focus | FAIL | FAIL | shell S1, S2 only. Founderhall's offset sidebar is a reference quirk. Community shows the focus ring on the field. |
| member-asks-post-error | FAIL | FAIL | shell S1, S2 only. Both show the browser's "Please fill out this field." |
| member-asks-posted-confirm | FAIL | FAIL | **Behaviour:** posting "Who can intro me to a buyer…" with target "Head of procurement at a US hospital" finds **nobody**. Flash reads "Posted. Nobody has a path yet; it goes into Thursday's digest." where Founderhall says "Posted. We told the members who can help.". "Nobody found yet" replaces "1 member can help" (Marcus Webb, path line, "Knows Rosa Lindqvist… Close", "Ask Marcus for an intro", "Message"). The rail reads "It goes into Thursday's digest…" where Founderhall says "1 member was told by email…". No helper email is sent. Cause: `findPersonToReach` (`src/shell/ask-helpers.ts`) takes the first non-member search result. For Sam that is Alex Kim, whom he already knows himself (`/search` lists Alex, Dana, then Rosa via Marcus), so it finds no member path. PR #50's own proof did find a helper here (Dana Whitfield), so this broke after later merges. Plus shell S1, S2. |
| member-asks-update-posted | FAIL | FAIL | shell S1, S2. Founderhall's shot is a capture quirk: its Update toggle didn't take, so it shows an ask with no target. Founderhall's code sends a real Update to `/asks?tab=updates&m=updated` "Update posted.", and Community does exactly that. Community's posted-without-a-path page (the posted-confirm shot) matches Founderhall's layout and words here. |
| member-asks-tab-yours | FAIL | FAIL | The new hospital ask lacks the "1 member can help · 1 through a warm path" strip (same cause as posted-confirm). Plus shell S1, S2. The 40th-clinic item shows "Update" with no Mark answered, which is right for a real update. |
| member-asks-tab-answered | FAIL | FAIL | shell S1, S2 only. |
| member-asks-tab-updates | FAIL | FAIL | shell S1, S2 only (the extra Sam update is the real update posted above). |
| member-asks-search | FAIL | FAIL | The first result (Sam's new ask) lacks the helpers strip (same cause as posted-confirm). Plus shell S1, S2. |
| member-asks-search-empty | FAIL | FAIL | shell S1, S2 only. |
| member-ask-detail | FAIL | FAIL | shell S1, S2. 1280: the "A line for Amara" textarea is about 2 px shorter, so "Offer help" sits about 3–5 px higher. 390: the answer box's Send button is taller and sits 4 px lower, centred instead of top-aligned. |
| member-ask-detail-helper-view | FAIL | FAIL | shell S1, S2; the same textarea and Send-button nits as member-ask-detail. |
| member-ask-detail-owner-with-helpers | FAIL | FAIL | shell S1, S2; the same nits. The "Report this answer" lines are a kept call. |
| member-ask-offer-help-done | FAIL | FAIL | shell S1, S2; the same nits. Flash words and the "Knows someone" answer match. |
| member-ask-answer-posted | FAIL | FAIL | shell S1, S2; the same nits. Founderhall's top bar mid-page at 390 is a reference quirk. |

Without the shell findings (S1, S2) and T1, the pure page-body verdict would be: PASS for 15 shots, and FAIL for
posted-confirm, tab-yours and search (the path check), plus the small form nits on the 5 ask-detail shots.

### Emails
| Email | PASS/FAIL | Differences |
|---|---|---|
| email-ask-for-help | PASS | Subject and body word for word (caught from Priya's seed-round ask to Sam). The "Or reply to this email…" line and the Reply-To are left out because reply-by-email isn't configured in this run, which is the same rule as Founderhall. The email is never sent for path helpers (see posted-confirm). |
| email-ask-help-offered | FAIL | Words match. **Link:** "Write the note Priya forwards (we drafted it from your profile):" points to `/asks/<id>` where Founderhall points to `/intros/new?draft=<id>`, its note page. |
| email-digest-test | PASS | "[Test] Maya, that's everything this week" with the body word for word. |
| digest words (`admin-digest-preview-sam`) | PASS | Priya's preview is word for word, except "Answer any item with its link." and no "Or reply HELP 1 · SKIP 1" line. That follows the replies-off setting and is noted in PR #50. RIGHT / HIDE / FIX reply codes don't exist yet (known, PR #50 gap). I couldn't see them here because Sam's fact had already been answered and replies are off. |
| email-digest-reply-did-not-go-through | PASS | Read from the code (`renderDigestHint`): the subject and the three lines are word for word. The email can't be triggered without an inbound reply. |

### Broken anywhere (no shot)
- `/asks/<unknown uuid>` and `/asks/nope`: the not-found page answers **200** (known, PR #50 gap).
- Invite → welcome (area 8, seen while reaching the new-member state): after the privacy step the new member lands on **/directory**, where Founderhall lands on /today ("member-welcome-done-today"). The member also gets "Check your email to confirm it's you" (an email_confirmation email is queued) although they arrived from the emailed invite link.
- No page errors, no 5xx and no sideways spill on any page visited at 390 or 1280.

### States I could not reach
- member-asks-posted-confirm with a helper: Community's path check finds nobody for this ask (a product FAIL, above). Everything else was reached.

## g2-search-ask: Search and asking for an intro (areas.md section 2, PR #52)

Captured with `.ai/tmp/check/cap-g2-search-ask.mjs` (args `1280`, `390`, `nc1280`, `nc390`, `pairs`). I signed in as Sam Lee.
I reached the not-connected states as Felix Moreau, a demo member who has not joined the Village group. Founderhall used
Nadia Cole for them; who appears is data. Pairs are in `.ai/tmp/check/pairs/`.

**Shell, every shot, both widths (not this area, so it does not count toward the verdicts below):** the fund mark is a
teal tile with the initials "NF". Founderhall shows its logo tile (the "≡A" mark). This is the same in the sidebar at
1280 and the top bar at 390.

| Shot | 1280 | 390 | Differences (each one short and concrete; "—" if none) |
|---|---|---|---|
| member-search-empty | PASS | PASS | — (the strip count of 12 vs 3 is data) |
| member-search-results | PASS | PASS | — (the extra member row, Tomas Novak, is data from the canned results) |
| member-search-results-know-directly | PASS | PASS | — |
| member-search-results-none-in-network | PASS | PASS | — (Jonas Lind vs Jo Wright is data) |
| member-search-no-results | PASS | PASS | — |
| member-search-everywhere | PASS | PASS | — |
| member-search-not-connected | PASS | PASS | — ("Connect yours" link to /me/network is present) |
| member-search-not-connected-query | PASS | PASS | — |
| member-intro-ask-onestep | FAIL | FAIL | (known) The page does not tell the member that admins see who asked whom. The owner's decision of 2026-11-11 asks for one plain line where members ask for an intro. Route: /search/ask?target=&via=&back= instead of Founderhall's /intros/new?draft=. PR #52 described this; nothing visible changes. Words, layout and the drafted note match. |
| member-intro-ask-onestep-error | FAIL | FAIL | (known) Same missing admins-see line. The error state itself matches: the textarea is `required` and the browser says "Please fill out this field." Headless capture does not draw the browser bubble, so it is missing from the Community picture; that is not a product difference. |
| member-intro-asked-confirm | PASS | PASS | — (the date 12 Nov vs 11 Nov is data) |
| member-intro-ask-from-profile | FAIL | FAIL | (known) No line saying admins see who asked whom (owner's decision; see onestep). Everything else matches word for word, including "7 days" on the rail: the old "14 days" is gone. "Was it helpful? One question, 14 days later." is Founderhall's own wording. |
| member-intro-ask-from-profile-error | FAIL | FAIL | (known) Same missing admins-see line. The Name field is `required` and says "Please fill out this field."; headless capture does not draw the bubble. |
| member-intro-asked-from-profile | PASS | PASS | — |
| member-ask-guided-start | PASS | PASS | — (rail says "7 days"; the allowance count is data) |
| member-ask-guided-need-1 | PASS | PASS | — |
| member-ask-guided-need-2 | PASS | PASS | — |
| member-ask-guided-need-3 | PASS | PASS | — |
| member-ask-guided-need-4 | PASS | PASS | — |
| member-ask-guided-step-3 | PASS | PASS | — |
| member-me-network-connect | PASS | PASS | — The tick hint ("Connecting shares your network… so tick it to go on") and "You can stop sharing any time: you leave the community's group in Village" are kept calls from PR #52. "In EU, Frankfurt, DigitalOcean." is the hosting setting, which is data. |
| member-me-network | FAIL | FAIL | 1) An extra "Change my LinkedIn or stop sharing" disclosure sits under the privacy line, and Founderhall has none. PR #52 parked it here until area 4 moved Stop sharing to My profile. My profile's network sheet now has Stop sharing and Disconnect (`src/shell/my-network-sheet.tsx`), so this line is a leftover. 2) "Back to my profile" and the "‹ My profile" back link go to `/me`; Founderhall goes to `/me#network`. |

Specific checks asked for:
- **"14 days" vs 7 days:** fixed. The from-profile rail says "Ada decides — By email or here. 7 days, then the ask closes…", and the guided /ask rail says "They decide — … 7 days…". Both match Founderhall and the intro timing.
- **The admins-see line on /intros/new:** missing. The page text has no mention of admins, and neither does /search/ask or /ask. The intro detail page does carry Founderhall's line: "Only the people in this intro see the note. Northwind Founders' admins see names, states and dates."

### Emails
| Email | PASS/FAIL | Differences |
|---|---|---|
| email-intro-ask-to-connector | PASS | — The outbox row has the subject "Marcus, would you introduce Sam Lee to Rosa Lindqvist?", is sent to marcus.webb@example.com and is kind `intro_asked`. Demo mode blanks the stored body, so I compared the template in `src/modules/intros/email-copy.ts` (`renderConnectorAsk`) line by line with `copy/emails/email-intro-ask-to-connector.md`. The words match, including the forwardable note, the three answer links, the YES/NO reply line and the footer. The answer links go to `/intros/<id>?a=…` (signed in) rather than `/i/<token>`, a seam PR #52 noted for area 3. |

### Broken anywhere (no shot)
- Client console, on the first page load of the run (/me/network or /search) and once more near the end: "Minified React error #419", meaning the server could not finish a Suspense boundary and the page fell back to client rendering. Nothing breaks visibly.
- No 5xx responses, overlaps, cut text or spill at 390 on any page visited.
- Capture oddity, possibly worth a look: I set Sam Lee's `member_network.group_joined_at` to null in the demo database. /me/network still showed "Your network is connected", and /search still showed no "Connect yours" line. So the demo seems to re-join Sam, or reads his connection from somewhere else. A demo member who never joined (Felix Moreau) shows the not-connected states correctly.

### States I could not reach
- None. The native "Please fill out this field." bubbles in the two error shots are browser chrome that headless screenshots do not draw. I confirmed the behaviour through `validationMessage` and the `required` attribute.

**Counts:** 44 shot-widths: 32 PASS, 12 FAIL (8 of the FAILs are the known admins-see line; 4 are /me/network). Email: 1 PASS.

## g3-intros-inbox: Intros (area 3), Inbox, Jobs, Perks (area 5)

Capture: `.ai/tmp/check/cap-g3-intros-inbox.mjs` (`node cap-g3-intros-inbox.mjs 1280|390 [reply]`, then `pairs`). Pairs are in `pairs/<shot>-<w>.jpg`. Logs (statuses, outbox subjects, measurements) are in `g3-log-<w>[-reply].json`.
How the states were reached: Sam asks Marcus for Rosa Lindqvist (CTO, Halcyon Health) on `/intros/new?via=<Marcus>` with Founderhall's note. He asks Ada for Nina Patel (Brightline Payments) and withdraws. The outbox wipes email bodies after a send, so the connector and target links are made the way `issueAnswerLink` and `createConsentLink` make them (a token whose hash goes into `intro_answer_link` or `intro_consent_link`). Empty states: Noah Berg, after deleting his intros and conversations in the scratch database.
A second run with `RESEND_REPLY_DOMAIN=reply.northwind.example` (`g3r-*` shots, `pairs-g3r/`) shows what the introduced screens look like when the joining email can go through the outbox. This domain is fake, and the demo outbox never sends.

Shell items on every member shot, not this group's (the foundation's, already listed in the PRs): the "NF" monogram where Founderhall has its logo tile, and the count badge on Intros (sidebar and phone tab). Founderhall shows no badge. Neither is counted below.

| Shot | 1280 | 390 | Differences (each one short and concrete; "—" if none) |
|---|---|---|---|
| member-intros-list | PASS | PASS | — (avatar tint on "AK" differs at 390: shell Avatar) |
| member-intros-list-after | FAIL | FAIL | Default demo: Rosa's row says "With Marcus" where Founderhall says "Introduced". The double yes never introduces in the demo (see Behaviour below). With a reply domain, the row says "Introduced" and matches. The extra "Nina Patel · Withdrawn" row comes from my capture order: Founderhall shot the list before the withdraw. |
| member-intros-empty | PASS | PASS | — The link goes to `/directory`, as in Founderhall (its code: `<a href="/directory">directory</a>`). It does NOT go to `/search`: the pending note's "points to /search" does not match Founderhall. |
| member-intro-tracker-asked | PASS | PASS | — |
| member-intro-tracker-introduced | FAIL | FAIL | Default demo: the pill says "With Marcus". The "Introduced by email" step stays open, and "Withdraw my ask" shows where Founderhall has "Open the intro thread", even after Rosa said yes. With a reply domain it is identical to Founderhall. |
| member-intro-withdrawn | PASS | PASS | — |
| member-intro-outcome-saved | FAIL | FAIL | Same as tracker-introduced: default demo is "With Marcus" and still has Withdraw. It matches with a reply domain. In both apps the state is the tracker right after the introduction. |
| member-intro-answer-in-app | PASS | PASS | — "Report this note" and "Message Marcus" under the note are kept Community parts (PR #46). |
| member-intro-detail-1 | PASS | PASS | — (same kept parts) |
| member-intro-detail-2 | PASS | PASS | — |
| public-intro-decide-connector | PASS | PASS | — |
| public-intro-decide-connector-error | PASS | PASS | — |
| public-intro-decide-connector-yes-done | PASS | PASS | — |
| public-intro-decide-target | PASS | PASS | — |
| public-intro-decide-target-yes-done | FAIL | FAIL | The page looks the same. In the default demo it is untrue: "You're introduced. Check your email: one message to you and Sam, with Marcus copied" shows while no introduction is sent. The intro stays "accepted", and Sam gets "Rosa said yes to your intro… Marcus will connect you both". |
| public-intro-decide-closed | PASS | PASS | — |
| public-intro-optout | PASS | PASS | — (the address is data) |
| member-inbox-list | PASS | PASS | — |
| member-inbox-empty | PASS | PASS | — |
| member-inbox-thread | PASS | PASS | — "Block Priya" under the composer is a kept call. Phone reply box: Community's textarea is 40 CSS px tall (rows=1) at both widths. That is the same height as Founderhall's in the pair (`rows="1"`, `resize:vertical`). |
| member-message-new | PASS | PASS | — |
| member-message-sent-thread | PASS | PASS | — The "Delete" under the new bubble shows only because the mouse was still over it after Send (it is `opacity-0`, shown on hover). This is a capture artifact. |
| member-jobs-board | PASS | PASS | — Company logos and dates are data. |
| public-jobs-board | FAIL | FAIL | The footer line reads "Hosted by Northwind Founders, EU, Frankfurt, DigitalOcean". Founderhall reads "Hosted by Northwind Founders, EU (Frankfurt)". This is the shared public footer's format; the provider name is data. |
| member-perks-on | PASS | PASS | — The demo deals inside the frame, and so the frame's height, are a kept call (PR #49). |
| member-perks-off | PASS | PASS | — The page answers 404, title "Not found · Northwind Founders", inside the app frame. |

### Behaviour: the double yes doesn't introduce in the demo (FAIL, area 3)
- With `DEMO_MODE=true` and no `RESEND_REPLY_DOMAIN`, `tryJoiningByEmail` reaches `sendJoiningEmail`. That function's no-reply-signer branch calls `sendResendEmail` directly, bypassing the outbox. The demo Resend config throws "This is a demo, so nothing is sent outside this server." (`server-demo.log`: `intro-joining-email`).
- The intro then falls back to Community's "connector joins by hand" path. The person still sees Founderhall's "You're introduced" page.
- Fix idea for the fix pass: send the no-reply-domain introduction through the outbox too, so demo and email-less setups complete like Founderhall. Or keep the fallback, but do not show "You're introduced" when nothing was sent.
- With a reply domain set, everything matches: three "Sam ↔ Rosa, via Marcus" emails go into the outbox, the intro is Introduced, and "Open the intro thread" shows.

### Not-found answers (signed in as Sam, production build)
Founderhall answers 404 to all of these (`server.mjs` `notFound`; `intros/routes.mjs:101,123,212,221`). Its bad `/i/<token>` is a 404 with the words "Nothing to do / This link doesn't work. It may be old or cut short." Founderhall uses 410 only for bad sign-in and invite links. Community:
| URL | Community status | Community words | Verdict |
|---|---|---|---|
| `/inbox/<unknown uuid>`, `/inbox/nope` | 200 | "This conversation isn't available / The link may be old, or it may belong to someone else's conversation." | FAIL: should be 404 (and Founderhall's words are "That page isn't here · Go to the start") |
| `/messages/new?to=<unknown>`, `?to=nope`, no `to` | 200 | "That page isn't here / Go to the start" | FAIL: right words, status should be 404 |
| `/intros/<unknown uuid>`, `/intros/nope` | 200 | "This intro isn't available / It may have been removed, or it belongs to someone else. Your intros." | FAIL: should be 404 (Founderhall: "That page isn't here") |
| `/i/nope`, `/i/<Founderhall-shaped token>` (signed in and signed out) | 200 | "Nothing to do / This link doesn't work. It may be old or cut short." | FAIL: right words, should be 404 |
| `/intro/optout/nope` | 200 | The full opt-out form: "We won't send intro asks to this address again…" plus the "Don't send me intro asks" button | FAIL: Founderhall answers 404 and replaces the form with "This link doesn't work. It may be old or cut short." |
| `/meet/nope` | 308 → `/i/nope` | — | ok |
| `/perks` while off | 404 | "That page isn't here" | PASS |
(Known: PR #49 lists "other in-app not-found pages still answer 200".)

### Phone foot links and "Our jobs"
- Phone foot: Jobs and Perks are already gone (`LINKED_FROM_PAGES` in `src/shell/shell-chrome.tsx`). The foot shows only Sign out and Source code. On a phone, Jobs is reachable from the Directory's "Jobs at member companies" link, and Perks from the Today card.
- The hand-off they waited on is NOT done (FAIL, areas 4/5):
  - My profile (`/me`) has no "Our jobs" section. It still has Community's "Your company's jobs" card (`CardJobsSection`), not Founderhall's `OurJobsSection` at `#jobs`.
  - The board's "Hiring? Add your company's jobs on My profile." link goes to `/jobs/yours`. `JOB_BOARD_PAGES.yours` is still `/jobs/yours`; that page answers 200 and does not redirect to `/me#jobs`.
  - So the words say "on My profile" but the link opens a separate page.

### Emails
| Email | PASS/FAIL | Differences |
|---|---|---|
| email-intro-ask-to-target | PASS | Subject and body match Founderhall word for word (`email-copy.test.ts` passes against `email-copy.fixtures.json`; I diffed the fixtures against `copy/emails/*.md`: identical). The live outbox has the subject "Marcus Webb would like to introduce you to Sam Lee". Minor: its outbox kind is `intro_target_reminder` even for the first ask, so the email log labels it as a reminder. |
| email-intro-ask-to-target-reminder | PASS | Matches (template plus fixture; sent only by a timed job). |
| email-introduction | FAIL | The words match (subject "Sam ↔ Rosa, via Marcus", three outbox rows when a reply domain is set). In the default demo it is never sent (see Behaviour): Sam and Marcus get Community's "Rosa said yes to your intro" and "Rosa said yes" notices instead. The connector's copy shows no addresses: kept call. |
| email-intro-declined-to-asker | PASS | Words match with `REQUESTER_SEES_WHO_ANSWERED=true`. As shipped it says "They can't make this one": kept call (PR #46). |
| email-intro-expired-to-asker | PASS | Matches. |
| email-intro-closed-to-connector | PASS | Matches. |
| email-intro-closed-to-connector-declined | PASS | Matches. |
| email-intro-closed-to-connector-expired | PASS | Matches. |
| email-intro-outcome-question | PASS | Matches (timed job; template plus fixture). |
| email-intro-outcome-question-reminder | PASS | Matches. |
| email-intro-thanks-to-connector | PASS | Matches. |
| email-message-notify | PASS | The subject "Sam Lee sent you a message" is in the outbox. The body leaves out the message ("…sent you a message." instead of "…sent you a message:" plus the text): kept call (PR #49). Without a reply domain, the line reads "Open it in the portal: <link>" in place of "Reply to this email to answer, or open it in the portal". The stop line and the sign-off match. |

### Broken anywhere (no shot)
- `/intro/optout/<bad token>` offers a working-looking "Don't send me intro asks" button for "this address" on a dead link (see the table above).
- Default demo: "You're introduced" is shown to the person asked while nothing is sent (see Behaviour).
- No page errors, 500s, overlaps or spill at 390 on any page I opened.

### States I could not reach
- None. The introduced states could only be reached in the demo with a reply domain set, which counts as a product FAIL, not a capture limit. The connector and target links were made in the database because the outbox keeps no bodies after a send.

**Counts:** shots: 42 PASS, 10 FAIL (52 cells). Emails: 11 PASS, 1 FAIL. Not-found statuses: 5 FAIL rows. "Our jobs" hand-off: FAIL.

## g4-directory-signin — Directory, profiles, My profile, Your data (area 4) · Sign-in, invites, onboarding (area 8)
Capture: `.ai/tmp/check/cap-g4-directory-signin.mjs` (`node cap-g4-directory-signin.mjs demo 1280|390`, `... fresh`, `... pairs`).
Pairs in `.ai/tmp/check/pairs/`, run notes in `cap-g4-notes-*.txt`. Not counted as differences: demo data (member counts, dates, faces), the NF initials tile, "EU, Frankfurt, DigitalOcean" (PR #45 says this is data), kept calls (the password link under sign-in; tags, LinkedIn and website, Block, How you sign in, Dark mode, the extra consent rows; members keep the real delete instead of "Ask to delete"), and avatar tints (they come from each person's id: Lena Fischer is beige in both apps).

| Shot | 1280 | 390 | Differences (each one short and concrete; "—" if none) |
|---|---|---|---|
| member-directory-populated | PASS | PASS | — ("Jobs at member companies (5)" link is there and goes to /jobs) |
| member-profile-other | FAIL | FAIL | The Message button's icon is a round chat bubble; Founderhall uses a square speech bubble. PR #47 left this to the shared foundation, and it is not a kept call. Everything else is the same (Looking for, Tags, Links and Block are kept or data). |
| member-me-profile | FAIL | FAIL | (known) No "Our jobs" section and no `#jobs` anchor: the old "Your company's jobs" card (Ashby · 2 open jobs, "Manage or link another") shows instead. Missing: "The job board" link, the job rows with Remove, "Add a job by hand", "Hide this company from the board", Remove, "Add another company or board". (known) The dead "Credit me in reports" switch card is still in the right column. |
| member-me-edit-field | FAIL | FAIL | The inline edit itself matches (input, Save, Cancel). The rest of the page has the same two (known) problems as member-me-profile: no Our jobs, and the Credit me in reports card is still there. |
| member-me-profile-new | FAIL | FAIL | (known) Our jobs: Founderhall has "Our jobs" with "The job board", Company + Hiring tool select + Careers link and "Pull our jobs". Community shows "Your company's jobs" with different words ("Paste your careers link and your open jobs show…", "From your card…", a long list of tools) and two buttons, "Link our hiring tool" (disabled) and "Add jobs by hand instead". (known) The Credit me in reports card is still there. |
| member-me-data | FAIL | FAIL | (known, dead credit switch) Your consent record has an extra row, "Named in partner reports: on", for the switch that should be gone. |
| member-me-data-saved | FAIL | FAIL | Same "Named in partner reports" row (known). Behaviour: after Save, Founderhall reloads to `/me/data?m=privacy#switches` and scrolls to the switches. Community shows the flash but stays at `/me/data` at the top of the page. 390: the left label "Members can ask you for intros" wraps to 3 lines next to its long value (cramped). |
| member-me-data-json | FAIL | FAIL | Same "Named in partner reports" row (known). The export works: it downloads `my-data-2026-11-12.json`. |
| member-me-data-delete-asked | FAIL | FAIL | The delete confirm step (type "delete", "Delete my account for good", "Keep my account") is the owner's kept call. Only the "Named in partner reports" row remains (known). |
| member-me-email | PASS | PASS | — |
| member-me-email-saved | PASS | PASS | — (flash "Email settings saved.") |
| public-signin-default | PASS | PASS | — ("Sign in with a password" under the card is kept) |
| public-signin-error | PASS | PASS | — |
| public-signin-bad-link | FAIL | FAIL | The words and look match. Behaviour: `/auth?token=expired-or-used-token` answers HTTP 200; Founderhall answers 410 (PR #45 listed this as left open). |
| public-first-admin-link | PASS | PASS | — (fresh install: "Sign in to Your community / Signing in as dana.whitfield@example.com / Sign in". The name and teal colour differ because Founderhall's reference community had set its own name and colour.) |
| public-invite-join | PASS | PASS | — |
| public-invite-join-fresh | PASS | PASS | — |
| member-welcome-step1-empty | PASS | PASS | — (Community fills in "Nadia Cole" because my invite line included the name; Founderhall's invite had only the email) |
| member-welcome-step1-error | PASS | PASS | — |
| member-welcome-step2-privacy | PASS | PASS | — |
| member-welcome-done-today | PASS | PASS | — (lands on /directory with "You're in. This is the directory.") |
| public-404 | PASS | PASS | — (HTTP 404, title "Not found · Northwind Founders") |

### Specific checks
- **Bad-invite page (FAIL, known):** an unknown, used or expired `/invite?token=` shows "That link doesn't work any more / Invite links work once and last 14 days. **Ask for a fresh sign-in link instead.**" with the button **"Get a new sign-in link"** → /signin. Someone invited who never joined is not told to ask for a NEW INVITE. It answers HTTP 200 (shots `cm/x-bad-invite-*.png`, `cm/x-used-invite-*.png`). The password link correctly stays under sign-in only.
- **"Our jobs" on My profile (FAIL, known):** missing, and `#jobs` does not exist on /me (see above). **Directory "Jobs at member companies" link: PASS**, it is there and goes to /jobs.
- **"Credit me in reports" (FAIL, known):** still on My profile as its own card with a switch. Your data still has the "Named in partner reports" row. It is not on the member card in the Directory.
- **Unknown /people/<id> (FAIL):** `/people/<random uuid>` and `/people/nope` show the in-app "That page isn't here" card but answer **HTTP 200**, with the title "Member · Northwind Founders" (expected 404 and "Not found"). Shot `cm/x-people-unknown-*.png`.
- **Unknown company (FAIL):** `/jobs?company=no-such-company` shows the not-found card, answers **200**, title "Jobs · Northwind Founders". Shot `cm/x-jobs-company-unknown-*.png`. (pending-followups: "Other in-app not-found pages still answer 200".)
- public-404 `/no-such-page`: **404** (PASS). `/directory/zzz` 404. `/members/zzz` → 308 `/people/zzz` (then 200, as above).

### Emails
| Email | PASS/FAIL | Differences |
|---|---|---|
| email-signin-link | PASS | Subject "Your sign-in link for Northwind Founders" (from the outbox). The body in `src/platform/email/sign-in-link-email.ts` matches Founderhall word for word. Community also sends the same words as HTML (map.md accepts HTML + text). In demo mode the outbox row keeps only the subject (html/text are empty), so the body was checked against the code. |
| email-invite | PASS | Subject "Your place in Northwind Founders" (outbox). The words in `contract-invite-email.ts` match ("Hi," or "Hi <first name>," when the invite has a name; the lead; "Open this link to sign in…"; "The link works once and lasts 14 days."; the signature; the ignore line; the footer). HTML version has a "Sign in to <community>" button. |
| email-delete-request-to-admin | N/A (kept call) | Removed by the owner's decision: members delete for real, so no request email (PR #47 follow-up). |

Also seen in code, not in a shot: accepting an invite with one click still sends Community's own "Confirm your email for <community>" email ("Is this you?", a rounded pill button, its own colours `#0c2427`). Founderhall has no such email, and it is not in Founderhall's plain-text style. PR #45 says it is sent on purpose; it may be worth restyling.

### Broken anywhere (no shot)
- `/people/<unknown>`, `/jobs?company=<unknown>`: not-found pages answer 200 with the wrong tab title (see above).
- Your data at 390: "Members can ask you for intros" label squeezed to 3 lines beside its value.

### States I could not reach
- None. Notes: in demo mode the admin Invites page shows no invite link, so the script swaps the token on the invite the UI made. The lib's SETUP_TOKEN (23 characters) is too short for /setup (it needs 32), so the fresh run passes its own 32-character token through `env`.

## g5-console-a — Console: Home, Partner report, Intro log, Members (area 6, first half; PR #51)
Signed in as Maya Ortiz (demo) and as a new first admin "Dana Whitfield" (fresh install, made through /setup).
Capture: `.ai/tmp/check/cap-g5-console-a.mjs` (`node cap-g5-console-a.mjs demo|fresh`). It uses `lib-g5.mjs`, a copy of
lib.mjs on port 3157 with its own databases (cm_demo_g5 / cm_fresh_g5). I made the copy because the shared lock kept
breaking (see the note at the end). Pairs are in `pairs/<name>-<w>.jpg`; the dark and print shots are `cm/g5-dark-*`,
`cm/g5-light-print-report-1280.png` and `cm/g5-dark-print-report.pdf`.

Not counted as differences: the community data, the "NF" fund mark (the demo has no logo, a config difference in PR #51), Mail
(Resend) vs SMTP and the sending domain (config), the Set up count bubble and "Free up a LinkedIn profile" (kept calls),
and the name "Your community" on the fresh install vs "Harbor Ventures" (data).

| Shot | 1280 | 390 | Differences (each one short and concrete; "—" if none) |
|---|---|---|---|
| admin-home | PASS | PASS | — (the "On pace for about N this month" line is missing because Community's demo has 0 lookups: data) |
| admin-first-home-launch-checklist (fresh) | FAIL | FAIL | The fresh install's fund colour is teal (button, ticks, links, mark). Founderhall's default is the dark spine green #2C4A3E (design-system.md: "default fund colour"). The 1280 sidebar has no **Job board** row (Founderhall: Home · Partner report · Intro log · Members · Invites · Asks & digest · Job board · Set up), because the public job board starts off on a fresh install. Words and steps match. |
| admin-launch-checklist-live | PASS | PASS | — ("Northwind Founders, your colour. Done." without "logo": no demo logo, config) |
| admin-first-home-after-invites (fresh) | FAIL | FAIL | Same as the fresh checklist: teal default fund colour, and no Job board row in the sidebar. "2 invites sent. Invite more →" with the tick matches. The phone foot shows no old "Job board" link (fixed). |
| admin-partner-report | PASS | PASS | — |
| admin-partner-report-month | PASS | PASS | — (falls back to this quarter, same as Founderhall; identical to the quarter shot) |
| admin-partner-report-year | PASS | PASS | — (same as above) |
| admin-partner-report-all | PASS | PASS | — |
| admin-partner-report-send | FAIL | FAIL | Look: the hint "Saved for next time. Up to 20 addresses." sits about 5–6 px closer under the textarea than in Founderhall, so the form sheet is shorter. Everything else matches. |
| admin-report-sent | FAIL | FAIL | The same hint spacing as on -send. "Sent to 1 partner." matches (Founderhall's 390 reference shot lacks the note, its own capture quirk). |
| admin-first-partner-report-empty (fresh) | FAIL | FAIL | Teal default fund colour (Send to partners button, fund mark); no Job board row in the 1280 sidebar. The document matches word for word. |
| admin-intro-log | FAIL | PASS | 1280: the state pill "no answer from connector" wraps onto two lines (a 2-line, ~36 px block in the State column). Founderhall's pills are one line, 24 px (design-system §3.3). 390 fine. |
| admin-intro-log-open | PASS | PASS | — |
| admin-intro-log-made | PASS | PASS | — |
| admin-intro-log-declined | FAIL | PASS | 1280: the same two-line "no answer from connector" pills (2 of the 4 rows). |
| admin-intro-log-withdrawn | PASS | PASS | — |
| admin-intro-log-all-time | FAIL | PASS | 1280: the same two-line pill (2 rows). |
| admin-intro-limits-saved | FAIL | PASS | 1280: the same two-line pill. "Limits saved." flash matches. The address stays `/admin/intros#limits` (Founderhall: `?m=limits#limits`), which you can't see on the page. |
| admin-first-intro-log-empty (fresh) | FAIL | FAIL | Teal default fund colour (Partner report button); no Job board row in the 1280 sidebar. Empty state and forms match. |
| admin-members | PASS | PASS | — |
| admin-members-invited | PASS | PASS | — |
| admin-members-joined | PASS | PASS | — |
| admin-members-connected | PASS | PASS | — |
| admin-members-admins | PASS | PASS | — |
| admin-members-delete | PASS | PASS | Kept call (PR #47: the owner removed Founderhall's "Ask to delete" request; members delete themselves), so Community shows "Nobody here / Try another filter." where Founderhall shows Sam Lee "Asked to delete 11 Nov". See the leftover chip below. |
| admin-members-search-empty | PASS | PASS | — |
| admin-first-members-empty (fresh) | FAIL | FAIL | Teal default fund colour (Add members button, mark); no Job board row in the 1280 sidebar. |

### Emails
| Email | PASS/FAIL | Differences |
|---|---|---|
| email-partner-report | PASS | Subject and body match Founderhall word for word, line by line ("Northwind intros, Q4 2026 to date: 12 asked, 3 made, 4 declined", every section, the names line, "Sent by Northwind Founders via its member portal."). Notes: Community's outbox row also has an HTML part (the same text in a pre-wrap div); Founderhall sends plain text only. Community also adds an "Other connectors: …" line after the top 5 (Founderhall's demo had only 5 connectors, so you can't compare). Saved in `g5-outbox.json`. |

### Specific checks asked for
- **Partner report printed from dark mode: FAIL (known, PR #44 follow-up).** With `emulateMedia({ media: 'print', colorScheme: 'dark' })`, the `dark` class stays on and the print rules don't put the light tokens back. The report text computes to rgb(230,223,208) (h1, td), the small text to rgb(170,163,149), and the sheet stays #23211c. Printed on paper, browsers drop the backgrounds, so the text comes out pale cream on white. See `cm/g5-dark-print-report-1280.png` vs `cm/g5-light-print-report-1280.png`, and the PDF `cm/g5-dark-print-report.pdf`.
- **Admin pages in dark mode (Home, launch checklist, Partner report, Send to partners, Intro log, Members at 1280 and 390): no contrast problems found.** Pills, bars, chips, links, the mail preview and the forms all read clearly. The only flaw is the same two-line "no answer from connector" pill.
- **Console phone bar on fresh-install phone shots:** the old "Job board" footer link is gone. The phone foot has "Open source, AGPL-3.0" only, and the tab bar is Home · Intros · Asks · Members · Set up (badge) · Founder, matching Founderhall apart from the kept count bubble.

### Broken anywhere (no shot)
- Members, all states: the "Asked to delete" filter chip still shows and can never count above 0, because the request flow was removed (PR #47). It's a dead chip; the code comment in `console-members.ts` admits "none in Community today". Either drop it or say why it's there.
- Intro log at 1280: the "no answer from connector" pill wraps onto two lines (above). Also, Community's state words "no answer from connector", "declined by target" and "declined by connector" have no Founderhall copy to check against (Founderhall's demo had no declined or expired rows).
- Fresh install: the Partner report title reads "Your intros, Q4 2026 to date…" because the default name "Your community" is cut to its first word. That's data-driven, but it reads oddly on a fresh install.
- Partner report "By what the founder needed": every Community intro falls under "Other" (12 of 12 this quarter, 28 since launch), so Customer/Hire/Investor/Expert are always 0 in the demo. The seed (or the engine) records no need. It's data, but the section is always empty.

### States I could not reach
- admin-members-delete with a member listed: the "asked to delete" request doesn't exist in Community (owner's decision in PR #47). Not counted as a FAIL.

### Note for the orchestrator (the checking harness, not the product)
`lib.mjs`'s server lock is unsafe. Every process registers `process.on('exit', dropLock)`, and `dropLock` removes the lock whoever holds it. Any checker that exits (or calls withApp twice) deletes the lock of the checker running at that moment. The next waiter then resets the same database and starts a second server on port 3150. That happened to me three times: my DB connection was terminated mid-run, EADDRINUSE, then connection refused. The fix: in `dropLock`, remove the lock only when its pid is the current process. My copy `lib-g5.mjs` does that and uses its own port and databases.

## g6-console-b-setup: console (Invites, Asks & digest, Digest preview, Job board, Founder view) and Set up
Capture: `.ai/tmp/check/cap-g6-console-b-setup.mjs` (`node cap-g6-console-b-setup.mjs demo 1280|390`, `fresh 1280|390`, `pairs`).
Signed in as Maya Ortiz (admin). Fresh install: the first admin is made through `/api/setup` (Community needs a name, so the fresh admin is "Maya Ortiz", not Founderhall's unnamed "dana.whitfield"), then signed in with a password, because sign-in links are off while mail is off.
Not counted as differences (kept calls or setup): no demo logo (NF initials), the Set up count bubble, Revoke on invites, "A made-up member" and no reply codes in the digest (no `RESEND_REPLY_DOMAIN`), Pull now on linked boards, Pin on open asks only, Resend instead of SMTP and one sender address, Features and Reports rows on Set up, Community's extra Settings parts, no emailed sign-in links on Sign-in links and invite links shown only after Copy, Village sync-screen switches locked on, audit log without sign-ins.
Also not product: the "secret key stored unencrypted / no usable SETUP_TOKEN" notes on Settings, Village and Integrations come from lib.mjs's short demo setup token (`fhfp-setup-token-123456` is under 32 characters, so Community treats it as missing).
The sidebar drawn halfway down some 1280 shots (invites-error, invites-sent, asks-pinned, mail-test-sent) is a full-page-screenshot effect of the sticky sidebar after the page scrolled. It is not a product bug.

| Shot | 1280 | 390 | Differences (each one short and concrete; "—" if none) |
|---|---|---|---|
| admin-invites | FAIL | PASS | 1280: in Waiting to sign in, the meta line is cut with an ellipsis ("sent 10 Nov, ends 2…", "sent 9 Nov, end…"). Founderhall shows it whole. Resend + Revoke squeeze the row. 390: Resend/Revoke stack in two lines (Revoke is a kept call). |
| admin-invites-error | FAIL | PASS | Flash "Paste at least one email address." matches. 1280: same cut meta lines as admin-invites. |
| admin-invites-sent | FAIL | PASS | "2 invited." matches. 1280: the same cut meta lines ("sent 12 Nov, ends …"). |
| admin-invites-resent | FAIL | PASS | Flash "Invite sent again. The old link no longer works." matches. 1280: the same cut meta lines. |
| admin-first-invites | FAIL | FAIL | Fresh install: the console menu has no **Job board** (the module is off, see admin-first-job-board-empty). The default brand colour is a bright teal on the buttons, links, switch, radio card and fund mark; Founderhall's default is the dark green. The rest matches: the mail-off line, Send from your email, Copy all links, No open invites, the preview. |
| admin-asks-digest | PASS | PASS | — (Pin on answered asks is missing: kept call) |
| admin-asks-pinned | PASS | PASS | "Pinned." flash and Unpin match. |
| admin-first-asks-empty | FAIL | FAIL | Fresh: no Job board in the menu (1280); teal default colour on Save, the switch and links (both). Words and empty state match. |
| admin-digest-preview | PASS | PASS | — (no Reply-To header and no codes: kept/config) |
| admin-digest-preview-sam | FAIL | FAIL | Founderhall's shot is Priya's digest (member=2); Community shows Sam's (data). The test card always says "To maya…, with your own items this week (even when there is nothing to answer)". When another member is shown, Founderhall leaves out "(even when there is nothing to answer)". The digest body's structure and words match (no "Or reply HELP 1…" lines: no reply domain, config). |
| admin-digest-test-sent | PASS | PASS | "Test digest sent to you." matches. |
| admin-job-board | PASS | PASS | — (Pull now and ATS meta are kept. The company page link is `/jobs?company=<company>` instead of `/jobs/<company>`, an engine route) |
| admin-first-job-board-empty | FAIL | FAIL | Fresh install: `/admin/jobs` answers **Not found** ("That page isn't here"). Founderhall shows the Job board page (public board switch, No boards linked yet, embed). The whole Job board module is off on a fresh install, and the menu has no Job board entry. The kept call only covers the *public* board starting off. |
| admin-founder-view-today | PASS | PASS | Retaken after Perks was turned on, as Founderhall did: Founder-view strip, menu with Perks, Perks card and Jobs card match. Community also shows a "New this week" card (Kwame Asante), which comes from demo data. |
| admin-setup | FAIL | FAIL | The **Integrations** row says "optional" and links to `/admin/integrations`, which is **404 Not found** in the demo, because the Slack and Discord module is off. Founderhall's row opens the Integrations page. The Audit log row says "Every admin action, newest first: invites, settings, members and privacy changes" (Community logs no sign-ins: kept). |
| admin-first-setup | FAIL | FAIL | Fresh: no Job board in the menu (1280); teal default colour. The Set up bubble shows **5** on an empty install (see Broken). Rows, states and words match. |
| admin-settings | PASS | PASS | — (extra Community parts: kept. Mail checklist "Recent sends" counts are data) |
| admin-settings-saved | PASS | PASS | "Settings saved." matches. |
| admin-settings-error | PASS | PASS | "Some settings need a fix." and "Use a colour like #24525A." match. The swatch keeps the last good colour (#24525A, 8.5:1). Founderhall's falls back to its default green (9.6:1). Minor. |
| admin-mail | PASS | PASS | — (Resend, one sender, do-not-send words: kept. The log was empty at capture time: data) |
| admin-mail-test-sent | PASS | PASS | "Test email sent to you." matches; "Test from Northwind Founders" is in the log. |
| admin-first-mail-not-set | FAIL | FAIL | Fresh: no Job board in the menu (1280); teal default colour on Save and links. The page matches (Mail service not set, Nothing sent yet). |
| admin-village | PASS | FAIL | Same sections in the same order. Extra Community parts are kept: key inputs, "Who can introduce", the fill-in basis radios. Small word differences come from the engine ("portal number (a random ID)", "paths it showed for a day"). 390: the key fields' placeholder "Saved. Paste a new one to replace it" is cut at "replace". |
| admin-village-nudged | PASS | FAIL | "Nudge sent." flash and "Nudge sent 12 Nov … The next one is allowed from 12 Dec." match. 390: the same cut placeholder in the key fields. |
| admin-first-village-not-connected | FAIL | FAIL | Fresh: no Job board in the menu (1280); teal default colour (switches, Save keys, Off radio card). When the "Members agreed in our membership terms on" option is not chosen, it shows no date field here, though the Invites page shows one. Founderhall prefills the Service email; Community leaves it empty with a hint. |
| admin-import | FAIL | FAIL | Words: the email switch says "Off: they are added as invited, and their invite links wait on Sign-in links for you to send". Founderhall: "…and can sign in from the sign-in page with that address" (engine-true, acceptable). The consent hint says "Saved for **the whole community**, with today's date and your name". Founderhall, and Community's own Invites page, say "Saved for **each member** with today's date and your name". Community's two pages now contradict each other. |
| admin-signin-links | PASS | PASS | — (kept: no emailed sign-in links; a link shows only after Copy) |
| admin-first-signin-links | FAIL | FAIL | Fresh: no Job board in the menu (1280); teal default colour. Otherwise matches the kept call (the mail-off lead, two invites, Copy). |
| admin-first-invites-mail-off | FAIL | FAIL | Fresh: no Job board in the menu; teal default colour. 1280: Waiting to sign in meta cut ("sent 12 Nov, ends …"). 390: in "Send the 2 sign-in links yourself" the addresses are cut to "priya.shah…" / "sam.lee@e…" beside "Open in your email". The flash, the send list and All links match Founderhall's 1280. |
| admin-integrations | PASS | PASS | Taken after turning the Slack and Discord module on (in the demo it is off and the page is 404, see admin-setup). The page matches; the example link reads `/asks` instead of `/asks/12` (example only). |
| admin-perks | PASS | PASS | — |
| admin-perks-error | PASS | PASS | "That code was not saved." and the field error match. |
| admin-perks-on | PASS | PASS | "Settings saved.", Saved address, Remove the marketplace and the preview frame match. |
| admin-first-perks-off | FAIL | FAIL | Fresh: no Job board in the menu (1280); teal default colour (switch, Save perks). The page matches. |
| admin-audit | PASS | PASS | Retaken after the actions: the same rows (action in words, subject, actor, time). The demo seed writes no audit rows (data); no sign-ins logged (kept). |

### Specific checks
- **Settings brand card, dark mode** (`cm/x-admin-settings-dark-1280.png`, `-390.png`): FAIL. In the Preview row, the fund-mark tile is drawn in the light-mode accent (#24525A) with dark initials. "NF" is barely readable (about 2:1). The sidebar's own tile is fine in dark mode (light tile, dark text). The Preview's "Northwind Founders" label is muted grey. The hint lines ("Shown at the top…", "Passes 8.5 : 1 on white.") are readable.
- **Console phone bar on the fresh-install phone shots**: PASS. None of the fresh 390 shots shows an old "Job board" footer link; the foot is "Sign out" plus the product credit, and the 5-tab console bar plus Founder. The bar's Set up tab carries the bubble ("5", then "4" after invites).

### Emails
| Email | PASS/FAIL | Differences |
|---|---|---|
| email-mail-test | PASS | Subject "Test from Northwind Founders" (outbox). The demo outbox keeps no body (status "skipped", text and html empty). The body was checked in `src/platform/email/test-email.ts` and matches the copy word for word. The sender is Community's one address (kept). |
| email-digest-test | PASS | Subject "[Test] Maya, that's everything this week" (outbox). No body is stored in demo. `shell/weekly-email-compose.ts` carries the test line "(A test digest: it went only to you. …)", and the preview shows the rest word for word. No Reply-To and no reply codes (config). |
| email-invite | PASS | Subject "Your place in Northwind Founders" ×2 from Invites (outbox), plus the resend. No body is stored in demo. `modules/members/contract-invite-email.ts` matches the copy: "Hi,"/"Hi <first>,", the lead, "Open this link… then you are in", 14 days, the signature, the ignore line, the footer. |

### Broken anywhere (no shot)
- `/admin/integrations` (demo, 1280 and 390): **404 Not found** while the Slack and Discord module is off. Set up still lists Integrations as an "optional" row and links to it, so the row leads to a dead end. Either the row should go, or the page should stay open while the module is off, like Perks.
- `/admin/jobs` on a fresh install: 404. The Job board module is off by default, so the console menu loses Job board. Founderhall's console always has it.
- Fresh install: the Set up bubble shows **5** with no members, no reports and nothing to approve. The kept call says it counts "reports and approvals waiting". It looks like it counts something else, perhaps the not-yet rows. Worth confirming.
- Fresh install: the default brand colour is a bright teal. Founderhall's default is the dark green (#2B4A3C range). PR #51 handed this to the foundation, and it is not a recorded kept call.

### States I could not reach
- None. Email bodies could not be read from the outbox in demo mode (it stores no text or html), so the words were checked against the code that writes them.

