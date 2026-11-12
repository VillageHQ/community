# Round 4 review pairs — Founderhall (left) beside Community (right)

Every Founderhall screen (153 shots) retaken from Community's demo (made-up people) and, for the first-run
shots, a fresh install, at 1280 and 390 px, on the final build of this pull request. Each image is Founderhall on the
left and Community on the right at the same width. These copies are reduced to keep the folder small; the full-size
set is in `.ai/tmp/pairs-full/` (not committed). Verdicts are from checkers who built nothing.

**Counts (one per shot per width):** before the fix pass 178 PASS / 128 FAIL; after 279 PASS / 27 FAIL.
Shots with any difference left: 14 — `member-ask-detail`, `member-ask-detail-helper-view`, `member-ask-detail-owner-with-helpers`, `member-ask-offer-help-done`, `member-ask-answer-posted`, `member-intro-ask-from-profile`, `member-intro-ask-from-profile-error`, `member-intro-tracker-introduced`, `member-intro-outcome-saved`, `member-me-profile-new`, `admin-partner-report-send`, `admin-report-sent`, `admin-first-village-not-connected`, `admin-first-invites-mail-off`.

"PASS (kept: …)" marks a deliberate difference with its reason; the first check's full list is in `verdicts.md`.

## 1 · Today and Asks & updates (and the shell)

| Shot | 1280 | 390 | Pairs | Difference or kept reason |
|---|---|---|---|---|
| member-ask-answer-posted | FAIL | FAIL | [1280](pairs/1-today-asks/member-ask-answer-posted-1280.jpg) · [390](pairs/1-today-asks/member-ask-answer-posted-390.jpg) | (left) The same 6 px Offer-help gap; Send at 390 (kept). |
| member-ask-detail | FAIL | FAIL | [1280](pairs/1-today-asks/member-ask-detail-1280.jpg) · [390](pairs/1-today-asks/member-ask-detail-390.jpg) | (left) The "I can help" card has **6 CSS px less space above "Offer help"** (12 px against 18): at 1280 the button is at y 563–603 against 570–610, and the card ends 7 px higher. The textarea itself is the same height, so the old note ("textarea 2 px shorter") was wrong about the cause. At 390 it is the same 6 px gap, plus the answer box's Send button sitting 4 px lower (kept: "ask-detail answer box"). "Report this ask" is kept. If the "ask-detail answer box (2–4 px)" kept item was meant to cover the Offer-help gap too, this row is "PASS (kept)". |
| member-ask-detail-helper-view | FAIL | FAIL | [1280](pairs/1-today-asks/member-ask-detail-helper-view-1280.jpg) · [390](pairs/1-today-asks/member-ask-detail-helper-view-390.jpg) | (left) The same 6 px Offer-help gap; Send 4 px lower at 390 (kept). |
| member-ask-detail-owner-with-helpers | FAIL | FAIL | [1280](pairs/1-today-asks/member-ask-detail-owner-with-helpers-1280.jpg) · [390](pairs/1-today-asks/member-ask-detail-owner-with-helpers-390.jpg) | (left) The same 6 px Offer-help gap; Send at 390 (kept); "Report this answer/ask" (kept). |
| member-ask-offer-help-done | FAIL | FAIL | [1280](pairs/1-today-asks/member-ask-offer-help-done-1280.jpg) · [390](pairs/1-today-asks/member-ask-offer-help-done-390.jpg) | (left) The same 6 px Offer-help gap (button 623–663 against 630–670). The flash and the "Knows someone" answer match. Founderhall's mid-page top bar at 390 is a reference quirk. |
| member-asks-board | PASS | PASS | [1280](pairs/1-today-asks/member-asks-board-1280.jpg) · [390](pairs/1-today-asks/member-asks-board-390.jpg) | — |
| member-asks-compose-focus | PASS | PASS | [1280](pairs/1-today-asks/member-asks-compose-focus-1280.jpg) · [390](pairs/1-today-asks/member-asks-compose-focus-390.jpg) | — (Founderhall's shifted sidebar and its mid-page top bar are reference quirks) |
| member-asks-post-error | PASS | PASS | [1280](pairs/1-today-asks/member-asks-post-error-1280.jpg) · [390](pairs/1-today-asks/member-asks-post-error-390.jpg) | — ("Please fill out this field.") |
| member-asks-posted-confirm | PASS | PASS | [1280](pairs/1-today-asks/member-asks-posted-confirm-1280.jpg) · [390](pairs/1-today-asks/member-asks-posted-confirm-390.jpg) | Fixed: the helper row has the "Close" chip after "Knows Rosa Lindqvist (CTO at Halcyon Health)". The flash, "1 member can help", the path line, "Ask Marcus for an intro" / "Message" and the rail all match. |
| member-asks-search | PASS | PASS | [1280](pairs/1-today-asks/member-asks-search-1280.jpg) · [390](pairs/1-today-asks/member-asks-search-390.jpg) | — |
| member-asks-search-empty | PASS | PASS | [1280](pairs/1-today-asks/member-asks-search-empty-1280.jpg) · [390](pairs/1-today-asks/member-asks-search-empty-390.jpg) | — |
| member-asks-tab-answered | PASS | PASS | [1280](pairs/1-today-asks/member-asks-tab-answered-1280.jpg) · [390](pairs/1-today-asks/member-asks-tab-answered-390.jpg) | — |
| member-asks-tab-updates | PASS | PASS | [1280](pairs/1-today-asks/member-asks-tab-updates-1280.jpg) · [390](pairs/1-today-asks/member-asks-tab-updates-390.jpg) | — |
| member-asks-tab-yours | PASS | PASS | [1280](pairs/1-today-asks/member-asks-tab-yours-1280.jpg) · [390](pairs/1-today-asks/member-asks-tab-yours-390.jpg) | — (helper strip on the new ask) |
| member-asks-update-posted | PASS | PASS | [1280](pairs/1-today-asks/member-asks-update-posted-1280.jpg) · [390](pairs/1-today-asks/member-asks-update-posted-390.jpg) | — (Founderhall's shot is its own capture quirk; Community posts a real Update, "Update posted.") |
| member-today-fact-right-done | PASS | PASS | [1280](pairs/1-today-asks/member-today-fact-right-done-1280.jpg) · [390](pairs/1-today-asks/member-today-fact-right-done-390.jpg) | — |
| member-today-new-member | PASS | PASS | [1280](pairs/1-today-asks/member-today-new-member-1280.jpg) · [390](pairs/1-today-asks/member-today-new-member-390.jpg) | PASS (kept: the "Almost there · Check your email to confirm it's you" next-step card); see Broken |
| member-today-other-member | PASS | PASS | [1280](pairs/1-today-asks/member-today-other-member-1280.jpg) · [390](pairs/1-today-asks/member-today-other-member-390.jpg) | — |
| member-today-populated | PASS | PASS | [1280](pairs/1-today-asks/member-today-populated-1280.jpg) · [390](pairs/1-today-asks/member-today-populated-390.jpg) | — (390 top-bar name 1 px nit, as on every row) |
| member-today-skip-done | PASS | PASS | [1280](pairs/1-today-asks/member-today-skip-done-1280.jpg) · [390](pairs/1-today-asks/member-today-skip-done-390.jpg) | — (flash words match; the 40th-clinic post is a real Update, as before) |
| member-today-with-perks | PASS | PASS | [1280](pairs/1-today-asks/member-today-with-perks-1280.jpg) · [390](pairs/1-today-asks/member-today-with-perks-390.jpg) | — (Perks rail card and menu item match) |

## 2 · Search and asking for an intro

| Shot | 1280 | 390 | Pairs | Difference or kept reason |
|---|---|---|---|---|
| member-ask-guided-need-1 | PASS | PASS | [1280](pairs/2-search-ask/member-ask-guided-need-1-1280.jpg) · [390](pairs/2-search-ask/member-ask-guided-need-1-390.jpg) | — |
| member-ask-guided-need-2 | PASS | PASS | [1280](pairs/2-search-ask/member-ask-guided-need-2-1280.jpg) · [390](pairs/2-search-ask/member-ask-guided-need-2-390.jpg) | — |
| member-ask-guided-need-3 | PASS | PASS | [1280](pairs/2-search-ask/member-ask-guided-need-3-1280.jpg) · [390](pairs/2-search-ask/member-ask-guided-need-3-390.jpg) | — |
| member-ask-guided-need-4 | PASS | PASS | [1280](pairs/2-search-ask/member-ask-guided-need-4-1280.jpg) · [390](pairs/2-search-ask/member-ask-guided-need-4-390.jpg) | — |
| member-ask-guided-start | PASS | PASS | [1280](pairs/2-search-ask/member-ask-guided-start-1280.jpg) · [390](pairs/2-search-ask/member-ask-guided-start-390.jpg) | — (the allowance count is data) |
| member-ask-guided-step-3 | PASS | PASS | [1280](pairs/2-search-ask/member-ask-guided-step-3-1280.jpg) · [390](pairs/2-search-ask/member-ask-guided-step-3-390.jpg) | — |
| member-intro-ask-from-profile | FAIL | FAIL | [1280](pairs/2-search-ask/member-intro-ask-from-profile-1280.jpg) · [390](pairs/2-search-ask/member-intro-ask-from-profile-390.jpg) | (left, new this check) The "Through · Ada Okafor" card is **2 CSS px taller** than Founderhall's (1280: its bottom border is at y 344 against 342; 390: 752 against 748 image px at DPR 2). So the whole form below it (fields, note card, "Ask Ada") sits 2 px lower. The words, the "7 days" rail and the admins line (deliberate) are right. |
| member-intro-ask-from-profile-error | FAIL | FAIL | [1280](pairs/2-search-ask/member-intro-ask-from-profile-error-1280.jpg) · [390](pairs/2-search-ask/member-intro-ask-from-profile-error-390.jpg) | (left) The same 2 px taller "Through" card. The error itself matches ("Please fill out this field." on Name). At 1280 Community's full-page image draws the sticky sidebar part-way down, because the page scrolled to the field. This is a capture artifact (Founderhall's compose-focus shot has the same quirk), not a product difference. |
| member-intro-ask-onestep | PASS | PASS | [1280](pairs/2-search-ask/member-intro-ask-onestep-1280.jpg) · [390](pairs/2-search-ask/member-intro-ask-onestep-390.jpg) | — (the admins line is the owner's deliberate addition) |
| member-intro-ask-onestep-error | PASS | PASS | [1280](pairs/2-search-ask/member-intro-ask-onestep-error-1280.jpg) · [390](pairs/2-search-ask/member-intro-ask-onestep-error-390.jpg) | — ("Please fill out this field." on the note) |
| member-intro-asked-confirm | PASS | PASS | [1280](pairs/2-search-ask/member-intro-asked-confirm-1280.jpg) · [390](pairs/2-search-ask/member-intro-asked-confirm-390.jpg) | — |
| member-intro-asked-from-profile | PASS | PASS | [1280](pairs/2-search-ask/member-intro-asked-from-profile-1280.jpg) · [390](pairs/2-search-ask/member-intro-asked-from-profile-390.jpg) | — |
| member-me-network | PASS | PASS | [1280](pairs/2-search-ask/member-me-network-1280.jpg) · [390](pairs/2-search-ask/member-me-network-390.jpg) | — ("Change my LinkedIn profile" only, kept; both back links go to `/me#network`, per the probe) |
| member-me-network-connect | PASS | PASS | [1280](pairs/2-search-ask/member-me-network-connect-1280.jpg) · [390](pairs/2-search-ask/member-me-network-connect-390.jpg) | — (the tick hint, the "stop sharing" line and "EU (Frankfurt)" are kept calls or data) |
| member-search-empty | PASS | PASS | [1280](pairs/2-search-ask/member-search-empty-1280.jpg) · [390](pairs/2-search-ask/member-search-empty-390.jpg) | — (12 vs 3 members is data) |
| member-search-everywhere | PASS | PASS | [1280](pairs/2-search-ask/member-search-everywhere-1280.jpg) · [390](pairs/2-search-ask/member-search-everywhere-390.jpg) | — |
| member-search-no-results | PASS | PASS | [1280](pairs/2-search-ask/member-search-no-results-1280.jpg) · [390](pairs/2-search-ask/member-search-no-results-390.jpg) | — |
| member-search-not-connected | PASS | PASS | [1280](pairs/2-search-ask/member-search-not-connected-1280.jpg) · [390](pairs/2-search-ask/member-search-not-connected-390.jpg) | — ("Connect yours" present) |
| member-search-not-connected-query | PASS | PASS | [1280](pairs/2-search-ask/member-search-not-connected-query-1280.jpg) · [390](pairs/2-search-ask/member-search-not-connected-query-390.jpg) | — |
| member-search-results | PASS | PASS | [1280](pairs/2-search-ask/member-search-results-1280.jpg) · [390](pairs/2-search-ask/member-search-results-390.jpg) | — (the Tomas Novak row is data; Founderhall's "· from the last 10 minutes" is the cache line Community also has, a state difference) |
| member-search-results-know-directly | PASS | PASS | [1280](pairs/2-search-ask/member-search-results-know-directly-1280.jpg) · [390](pairs/2-search-ask/member-search-results-know-directly-390.jpg) | — |
| member-search-results-none-in-network | PASS | PASS | [1280](pairs/2-search-ask/member-search-results-none-in-network-1280.jpg) · [390](pairs/2-search-ask/member-search-results-none-in-network-390.jpg) | — (Jonas Lind vs Jo Wright is data) |

## 3 · Intros

| Shot | 1280 | 390 | Pairs | Difference or kept reason |
|---|---|---|---|---|
| member-intro-answer-in-app | PASS | PASS | [1280](pairs/3-intros/member-intro-answer-in-app-1280.jpg) · [390](pairs/3-intros/member-intro-answer-in-app-390.jpg) | — (kept: "Report this note", "Message Marcus") |
| member-intro-detail-1 | PASS | PASS | [1280](pairs/3-intros/member-intro-detail-1-1280.jpg) · [390](pairs/3-intros/member-intro-detail-1-390.jpg) | — The page and capture are byte-identical to answer-in-app on both sides. |
| member-intro-detail-2 | PASS | PASS | [1280](pairs/3-intros/member-intro-detail-2-1280.jpg) · [390](pairs/3-intros/member-intro-detail-2-390.jpg) | — |
| member-intro-outcome-saved | FAIL | FAIL | [1280](pairs/3-intros/member-intro-outcome-saved-1280.jpg) · [390](pairs/3-intros/member-intro-outcome-saved-390.jpg) | (left) Same page and state as tracker-introduced: no "Open the intro thread". |
| member-intro-tracker-asked | PASS | PASS | [1280](pairs/3-intros/member-intro-tracker-asked-1280.jpg) · [390](pairs/3-intros/member-intro-tracker-asked-390.jpg) | — |
| member-intro-tracker-introduced | FAIL | FAIL | [1280](pairs/3-intros/member-intro-tracker-introduced-1280.jpg) · [390](pairs/3-intros/member-intro-tracker-introduced-390.jpg) | (left) Founderhall's **"Open the intro thread"** button is missing. Replies by email are off in the demo, so there is no thread. Everything else matches: the "Introduced" pill, the four steps done, no Withdraw. |
| member-intro-withdrawn | PASS | PASS | [1280](pairs/3-intros/member-intro-withdrawn-1280.jpg) · [390](pairs/3-intros/member-intro-withdrawn-390.jpg) | — |
| member-intros-empty | PASS | PASS | [1280](pairs/3-intros/member-intros-empty-1280.jpg) · [390](pairs/3-intros/member-intros-empty-390.jpg) | — |
| member-intros-list | PASS | PASS | [1280](pairs/3-intros/member-intros-list-1280.jpg) · [390](pairs/3-intros/member-intros-list-390.jpg) | — |
| member-intros-list-after | PASS | PASS | [1280](pairs/3-intros/member-intros-list-after-1280.jpg) · [390](pairs/3-intros/member-intros-list-after-390.jpg) | — Rosa's row says "Introduced". The extra "Nina Patel · Withdrawn" row comes from the capture order. |
| public-intro-decide-closed | PASS | PASS | [1280](pairs/3-intros/public-intro-decide-closed-1280.jpg) · [390](pairs/3-intros/public-intro-decide-closed-390.jpg) | — |
| public-intro-decide-connector | PASS | PASS | [1280](pairs/3-intros/public-intro-decide-connector-1280.jpg) · [390](pairs/3-intros/public-intro-decide-connector-390.jpg) | — |
| public-intro-decide-connector-error | PASS | PASS | [1280](pairs/3-intros/public-intro-decide-connector-error-1280.jpg) · [390](pairs/3-intros/public-intro-decide-connector-error-390.jpg) | — |
| public-intro-decide-connector-yes-done | PASS | PASS | [1280](pairs/3-intros/public-intro-decide-connector-yes-done-1280.jpg) · [390](pairs/3-intros/public-intro-decide-connector-yes-done-390.jpg) | — (kept: "with you copied", see Left) |
| public-intro-decide-target | PASS | PASS | [1280](pairs/3-intros/public-intro-decide-target-1280.jpg) · [390](pairs/3-intros/public-intro-decide-target-390.jpg) | — (kept: "with Marcus copied", see Left) |
| public-intro-decide-target-yes-done | PASS | PASS | [1280](pairs/3-intros/public-intro-decide-target-yes-done-1280.jpg) · [390](pairs/3-intros/public-intro-decide-target-yes-done-390.jpg) | (kept: "with Marcus copied") The intro really completes: two `intro_thread` rows "Sam ↔ Rosa, via Marcus", state `completed`. |
| public-intro-optout | PASS | PASS | [1280](pairs/3-intros/public-intro-optout-1280.jpg) · [390](pairs/3-intros/public-intro-optout-390.jpg) | — (the address is data) |

## 4 · Directory, profiles, My profile, Your data

| Shot | 1280 | 390 | Pairs | Difference or kept reason |
|---|---|---|---|---|
| member-directory-populated | PASS | PASS | [1280](pairs/4-directory-profile/member-directory-populated-1280.jpg) · [390](pairs/4-directory-profile/member-directory-populated-390.jpg) | — "Jobs at member companies (5)" goes to /jobs. |
| member-me-data | PASS | PASS | [1280](pairs/4-directory-profile/member-me-data-1280.jpg) · [390](pairs/4-directory-profile/member-me-data-390.jpg) | **Re-check (6bd5361):** retaken on a fresh demo seed per width (Sam had no `member_privacy` row before the shot). "The community’s default — Now: anyone in the community." is selected at 1280 and 390, as Founderhall’s. The rest matches apart from data and kept rows (consent record wording, Your picture row, Dark mode switch, kept delete step). 390: the kept "Members can ask you for intros" label wraps to 3 lines beside its value (minor). |
| member-me-data-delete-asked | PASS | PASS | [1280](pairs/4-directory-profile/member-me-data-delete-asked-1280.jpg) · [390](pairs/4-directory-profile/member-me-data-delete-asked-390.jpg) | **Re-check:** "The community’s default" selected; the delete confirm step is kept. |
| member-me-data-json | PASS | PASS | [1280](pairs/4-directory-profile/member-me-data-json-1280.jpg) · [390](pairs/4-directory-profile/member-me-data-json-390.jpg) | **Re-check:** same page, "The community’s default" selected; the export downloads `my-data-2026-11-12.json`. |
| member-me-data-saved | PASS | PASS | [1280](pairs/4-directory-profile/member-me-data-saved-1280.jpg) · [390](pairs/4-directory-profile/member-me-data-saved-390.jpg) | **Re-check:** from the never-chose state, Save shows "Privacy settings saved." and "The community’s default" stays selected (stored as default), as Founderhall’s, at both widths. |
| member-me-edit-field | PASS | PASS | [1280](pairs/4-directory-profile/member-me-edit-field-1280.jpg) · [390](pairs/4-directory-profile/member-me-edit-field-390.jpg) | — The inline edit (input, Save, Cancel) matches. |
| member-me-email | PASS | PASS | [1280](pairs/4-directory-profile/member-me-email-1280.jpg) · [390](pairs/4-directory-profile/member-me-email-390.jpg) | — |
| member-me-email-saved | PASS | PASS | [1280](pairs/4-directory-profile/member-me-email-saved-1280.jpg) · [390](pairs/4-directory-profile/member-me-email-saved-390.jpg) | — |
| member-me-profile | PASS | PASS | [1280](pairs/4-directory-profile/member-me-profile-1280.jpg) · [390](pairs/4-directory-profile/member-me-profile-390.jpg) | — "Our jobs" is at the bottom, full width, and there is no credit switch. Data: Tallyhealth is linked to Ashby in Community's demo ("Open", "Pull now", "Last pulled…"). Minor: "Last pulled Nov 12, 2026, 10:30 AM UTC" uses US style while the rest of the app writes "12 Nov". |
| member-me-profile-new | FAIL | FAIL | [1280](pairs/4-directory-profile/member-me-profile-new-1280.jpg) · [390](pairs/4-directory-profile/member-me-profile-new-390.jpg) | (left) The empty "Our jobs" form differs from Founderhall's. There is no **Hiring tool** select. It adds "From your card. You share jobs for your own company." The Careers-link help is a long list of tools in place of Founderhall's "Paste your careers page or job board link… No key needed. Workday, iCIMS or another tool…". It shows a disabled **"Link our hiring tool"** plus **"Add jobs by hand instead"** where Founderhall has one **"Pull our jobs"**. |
| member-profile-other | PASS | PASS | [1280](pairs/4-directory-profile/member-profile-other-1280.jpg) · [390](pairs/4-directory-profile/member-profile-other-390.jpg) | — Square bubble on Message. Looking for, Tags, Links and Block are kept. |

## 5 · Inbox, Jobs, Perks

| Shot | 1280 | 390 | Pairs | Difference or kept reason |
|---|---|---|---|---|
| member-inbox-empty | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/member-inbox-empty-1280.jpg) · [390](pairs/5-inbox-jobs-perks/member-inbox-empty-390.jpg) | — |
| member-inbox-list | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/member-inbox-list-1280.jpg) · [390](pairs/5-inbox-jobs-perks/member-inbox-list-390.jpg) | — |
| member-inbox-thread | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/member-inbox-thread-1280.jpg) · [390](pairs/5-inbox-jobs-perks/member-inbox-thread-390.jpg) | — (kept: "Block Priya") |
| member-jobs-board | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/member-jobs-board-1280.jpg) · [390](pairs/5-inbox-jobs-perks/member-jobs-board-390.jpg) | — (logos and dates are data) |
| member-message-new | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/member-message-new-1280.jpg) · [390](pairs/5-inbox-jobs-perks/member-message-new-390.jpg) | — |
| member-message-sent-thread | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/member-message-sent-thread-1280.jpg) · [390](pairs/5-inbox-jobs-perks/member-message-sent-thread-390.jpg) | — "Delete" under the new bubble shows because the pointer is still over it after Send (a hover-only control; capture artifact). (Kept: "Block Ada".) |
| member-perks-off | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/member-perks-off-1280.jpg) · [390](pairs/5-inbox-jobs-perks/member-perks-off-390.jpg) | — 404, title "Not found · Northwind Founders". |
| member-perks-on | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/member-perks-on-1280.jpg) · [390](pairs/5-inbox-jobs-perks/member-perks-on-390.jpg) | — (kept: the demo deals in the frame, PR #49) |
| public-jobs-board | PASS | PASS | [1280](pairs/5-inbox-jobs-perks/public-jobs-board-1280.jpg) · [390](pairs/5-inbox-jobs-perks/public-jobs-board-390.jpg) | — The footer reads "EU (Frankfurt)". |

## 6 · Console

| Shot | 1280 | 390 | Pairs | Difference or kept reason |
|---|---|---|---|---|
| admin-asks-digest | PASS | PASS | [1280](pairs/6-console/admin-asks-digest-1280.jpg) · [390](pairs/6-console/admin-asks-digest-390.jpg) | — |
| admin-asks-pinned | PASS | PASS | [1280](pairs/6-console/admin-asks-pinned-1280.jpg) · [390](pairs/6-console/admin-asks-pinned-390.jpg) | "Pinned." and Unpin. |
| admin-digest-preview | PASS | PASS | [1280](pairs/6-console/admin-digest-preview-1280.jpg) · [390](pairs/6-console/admin-digest-preview-390.jpg) | — |
| admin-digest-preview-sam | PASS | PASS | [1280](pairs/6-console/admin-digest-preview-sam-1280.jpg) · [390](pairs/6-console/admin-digest-preview-sam-390.jpg) | With Sam previewed, the test card reads "…with your own items this week." with no bracket (log). Sam vs Priya is data. |
| admin-digest-test-sent | PASS | PASS | [1280](pairs/6-console/admin-digest-test-sent-1280.jpg) · [390](pairs/6-console/admin-digest-test-sent-390.jpg) | "Test digest sent to you." |
| admin-first-asks-empty | PASS | PASS | [1280](pairs/6-console/admin-first-asks-empty-1280.jpg) · [390](pairs/6-console/admin-first-asks-empty-390.jpg) | — |
| admin-first-home-after-invites | PASS | PASS | [1280](pairs/6-console/admin-first-home-after-invites-1280.jpg) · [390](pairs/6-console/admin-first-home-after-invites-390.jpg) | "2 invites sent. Invite more →" with the tick. |
| admin-first-home-launch-checklist | PASS | PASS | [1280](pairs/6-console/admin-first-home-launch-checklist-1280.jpg) · [390](pairs/6-console/admin-first-home-launch-checklist-390.jpg) | Green default colour (#2c4a3e). No Job board row (kept). |
| admin-first-intro-log-empty | PASS | PASS | [1280](pairs/6-console/admin-first-intro-log-empty-1280.jpg) · [390](pairs/6-console/admin-first-intro-log-empty-390.jpg) | — |
| admin-first-invites | PASS | PASS | [1280](pairs/6-console/admin-first-invites-1280.jpg) · [390](pairs/6-console/admin-first-invites-390.jpg) | Green default colour. No Job board in the menu (kept). The invite preview is signed "Maya Ortiz" because the fresh admin has a name (data). |
| admin-first-job-board-empty | PASS (kept) | PASS (kept) | [1280](pairs/6-console/admin-first-job-board-empty-1280.jpg) · [390](pairs/6-console/admin-first-job-board-empty-390.jpg) | Kept: "That page isn't here" (404), because the Job board is off on a fresh install. |
| admin-first-members-empty | PASS | PASS | [1280](pairs/6-console/admin-first-members-empty-1280.jpg) · [390](pairs/6-console/admin-first-members-empty-390.jpg) | — |
| admin-first-partner-report-empty | PASS | PASS | [1280](pairs/6-console/admin-first-partner-report-empty-1280.jpg) · [390](pairs/6-console/admin-first-partner-report-empty-390.jpg) | — (the title "Your intros…" comes from the default name: data) |
| admin-founder-view-today | PASS | PASS | [1280](pairs/6-console/admin-founder-view-today-1280.jpg) · [390](pairs/6-console/admin-founder-view-today-390.jpg) | The extra "New this week" card is demo data. |
| admin-home | PASS | PASS | [1280](pairs/6-console/admin-home-1280.jpg) · [390](pairs/6-console/admin-home-390.jpg) | The sidebar menu now starts at the same height as Founderhall's (Home at y≈154 in both); the 2 px offset is gone. The phone top bar matches. |
| admin-intro-limits-saved | PASS | PASS | [1280](pairs/6-console/admin-intro-limits-saved-1280.jpg) · [390](pairs/6-console/admin-intro-limits-saved-390.jpg) | "Limits saved." matches. The URL stays `/admin/intros#limits`, which doesn't show on the page. |
| admin-intro-log | PASS | PASS | [1280](pairs/6-console/admin-intro-log-1280.jpg) · [390](pairs/6-console/admin-intro-log-390.jpg) | Fixed: every pill is one line and 24 px, and the dot/ring/dash marks are back at 1280. The long "no answer from connector" ends in "…" ("no answer from conne…"), as asked. 390: unchanged, fine. |
| admin-intro-log-all-time | PASS | PASS | [1280](pairs/6-console/admin-intro-log-all-time-1280.jpg) · [390](pairs/6-console/admin-intro-log-all-time-390.jpg) | — |
| admin-intro-log-declined | PASS | PASS | [1280](pairs/6-console/admin-intro-log-declined-1280.jpg) · [390](pairs/6-console/admin-intro-log-declined-390.jpg) | Dash marks are back; the long states end in "…" on one line. |
| admin-intro-log-made | PASS | PASS | [1280](pairs/6-console/admin-intro-log-made-1280.jpg) · [390](pairs/6-console/admin-intro-log-made-390.jpg) | Filled-dot marks are back. |
| admin-intro-log-open | PASS | PASS | [1280](pairs/6-console/admin-intro-log-open-1280.jpg) · [390](pairs/6-console/admin-intro-log-open-390.jpg) | Ring marks are back. |
| admin-intro-log-withdrawn | PASS | PASS | [1280](pairs/6-console/admin-intro-log-withdrawn-1280.jpg) · [390](pairs/6-console/admin-intro-log-withdrawn-390.jpg) | — |
| admin-invites | PASS | PASS | [1280](pairs/6-console/admin-invites-1280.jpg) · [390](pairs/6-console/admin-invites-390.jpg) | The Waiting to sign in meta lines wrap whole. |
| admin-invites-error | PASS | PASS | [1280](pairs/6-console/admin-invites-error-1280.jpg) · [390](pairs/6-console/admin-invites-error-390.jpg) | "Paste at least one email address." |
| admin-invites-resent | PASS | PASS | [1280](pairs/6-console/admin-invites-resent-1280.jpg) · [390](pairs/6-console/admin-invites-resent-390.jpg) | "Invite sent again. The old link no longer works." |
| admin-invites-sent | PASS | PASS | [1280](pairs/6-console/admin-invites-sent-1280.jpg) · [390](pairs/6-console/admin-invites-sent-390.jpg) | "2 invited." |
| admin-job-board | PASS | PASS | [1280](pairs/6-console/admin-job-board-1280.jpg) · [390](pairs/6-console/admin-job-board-390.jpg) | — |
| admin-launch-checklist-live | PASS | PASS | [1280](pairs/6-console/admin-launch-checklist-live-1280.jpg) · [390](pairs/6-console/admin-launch-checklist-live-390.jpg) | — |
| admin-members | PASS | PASS | [1280](pairs/6-console/admin-members-1280.jpg) · [390](pairs/6-console/admin-members-390.jpg) | — |
| admin-members-admins | PASS | PASS | [1280](pairs/6-console/admin-members-admins-1280.jpg) · [390](pairs/6-console/admin-members-admins-390.jpg) | — |
| admin-members-connected | PASS | PASS | [1280](pairs/6-console/admin-members-connected-1280.jpg) · [390](pairs/6-console/admin-members-connected-390.jpg) | — |
| admin-members-delete | PASS (kept) | PASS (kept) | [1280](pairs/6-console/admin-members-delete-1280.jpg) · [390](pairs/6-console/admin-members-delete-390.jpg) | Kept: no "asked to delete" request in Community, so it shows "Nobody here". |
| admin-members-invited | PASS | PASS | [1280](pairs/6-console/admin-members-invited-1280.jpg) · [390](pairs/6-console/admin-members-invited-390.jpg) | — |
| admin-members-joined | PASS | PASS | [1280](pairs/6-console/admin-members-joined-1280.jpg) · [390](pairs/6-console/admin-members-joined-390.jpg) | — |
| admin-members-search-empty | PASS | PASS | [1280](pairs/6-console/admin-members-search-empty-1280.jpg) · [390](pairs/6-console/admin-members-search-empty-390.jpg) | — |
| admin-partner-report | PASS | PASS | [1280](pairs/6-console/admin-partner-report-1280.jpg) · [390](pairs/6-console/admin-partner-report-390.jpg) | — |
| admin-partner-report-all | PASS | PASS | [1280](pairs/6-console/admin-partner-report-all-1280.jpg) · [390](pairs/6-console/admin-partner-report-all-390.jpg) | — |
| admin-partner-report-month | PASS | PASS | [1280](pairs/6-console/admin-partner-report-month-1280.jpg) · [390](pairs/6-console/admin-partner-report-month-390.jpg) | — (falls back to the quarter, like Founderhall) |
| admin-partner-report-send | FAIL (left) | FAIL (left) | [1280](pairs/6-console/admin-partner-report-send-1280.jpg) · [390](pairs/6-console/admin-partner-report-send-390.jpg) | Left: the hint "Saved for next time. Up to 20 addresses." sits about 5 px tighter under the emails box. Everything else matches. |
| admin-partner-report-year | PASS | PASS | [1280](pairs/6-console/admin-partner-report-year-1280.jpg) · [390](pairs/6-console/admin-partner-report-year-390.jpg) | — |
| admin-report-sent | FAIL (left) | FAIL (left) | [1280](pairs/6-console/admin-report-sent-1280.jpg) · [390](pairs/6-console/admin-report-sent-390.jpg) | Left: the same hint spacing. "Sent to 1 partner." matches. |

## 7 · Set up

| Shot | 1280 | 390 | Pairs | Difference or kept reason |
|---|---|---|---|---|
| admin-audit | PASS | PASS | [1280](pairs/7-setup/admin-audit-1280.jpg) · [390](pairs/7-setup/admin-audit-390.jpg) | — (no sign-ins logged: kept; the rows are data) |
| admin-first-invites-mail-off | PASS | FAIL | [1280](pairs/7-setup/admin-first-invites-mail-off-1280.jpg) · [390](pairs/7-setup/admin-first-invites-mail-off-390.jpg) | **Re-check (6bd5361), retaken at both widths:** 1280: fine. 390: the small grey address line now breaks after the "@" ("priya.shah@ / example.com", "sam.lee@ / example.com"), so that part is fixed. The bold line still breaks mid-word. It now breaks after the "@" too, but "example.com" is wider than the name column beside the "Open in your email" button, so `break-words` splits it: "priya.shah@ / example.co / m", "sam.lee@ / example.co / m" (a lone "m"; crop `final-g6-crop-sendyourself-r2.png`). It needs a smaller bold line, a wider column (e.g. the button below at 390), or no mid-word break. F |
| admin-first-mail-not-set | PASS | PASS | [1280](pairs/7-setup/admin-first-mail-not-set-1280.jpg) · [390](pairs/7-setup/admin-first-mail-not-set-390.jpg) | — |
| admin-first-perks-off | PASS | PASS | [1280](pairs/7-setup/admin-first-perks-off-1280.jpg) · [390](pairs/7-setup/admin-first-perks-off-390.jpg) | — |
| admin-first-setup | PASS | PASS | [1280](pairs/7-setup/admin-first-setup-1280.jpg) · [390](pairs/7-setup/admin-first-setup-390.jpg) | — |
| admin-first-signin-links | PASS | PASS | [1280](pairs/7-setup/admin-first-signin-links-1280.jpg) · [390](pairs/7-setup/admin-first-signin-links-390.jpg) | — |
| admin-first-village-not-connected | FAIL (left) | FAIL (left) | [1280](pairs/7-setup/admin-first-village-not-connected-1280.jpg) · [390](pairs/7-setup/admin-first-village-not-connected-390.jpg) | Left: Service email is empty with a hint (Founderhall prefills `dana.whitfield+village@example.com`). The "membership terms on" date field shows only when that option is chosen. |
| admin-import | PASS (kept) | PASS (kept) | [1280](pairs/7-setup/admin-import-1280.jpg) · [390](pairs/7-setup/admin-import-390.jpg) | Kept: the "whole community" consent words. |
| admin-integrations | PASS | PASS | [1280](pairs/7-setup/admin-integrations-1280.jpg) · [390](pairs/7-setup/admin-integrations-390.jpg) | Taken with the Slack and Discord module on. The SETUP_TOKEN note is the harness artefact. |
| admin-mail | PASS | PASS | [1280](pairs/7-setup/admin-mail-1280.jpg) · [390](pairs/7-setup/admin-mail-390.jpg) | — |
| admin-mail-test-sent | PASS | PASS | [1280](pairs/7-setup/admin-mail-test-sent-1280.jpg) · [390](pairs/7-setup/admin-mail-test-sent-390.jpg) | "Test email sent to you." |
| admin-perks | PASS | PASS | [1280](pairs/7-setup/admin-perks-1280.jpg) · [390](pairs/7-setup/admin-perks-390.jpg) | — |
| admin-perks-error | PASS | PASS | [1280](pairs/7-setup/admin-perks-error-1280.jpg) · [390](pairs/7-setup/admin-perks-error-390.jpg) | "That code was not saved." |
| admin-perks-on | PASS | PASS | [1280](pairs/7-setup/admin-perks-on-1280.jpg) · [390](pairs/7-setup/admin-perks-on-390.jpg) | "Settings saved.", the saved address, Remove the marketplace. |
| admin-settings | PASS | PASS | [1280](pairs/7-setup/admin-settings-1280.jpg) · [390](pairs/7-setup/admin-settings-390.jpg) | — |
| admin-settings-error | PASS | PASS | [1280](pairs/7-setup/admin-settings-error-1280.jpg) · [390](pairs/7-setup/admin-settings-error-390.jpg) | "Some settings need a fix." and "Use a colour like #24525A." |
| admin-settings-saved | PASS | PASS | [1280](pairs/7-setup/admin-settings-saved-1280.jpg) · [390](pairs/7-setup/admin-settings-saved-390.jpg) | "Settings saved." |
| admin-setup | PASS | PASS | [1280](pairs/7-setup/admin-setup-1280.jpg) · [390](pairs/7-setup/admin-setup-390.jpg) | The Integrations row links to `/admin/features` (200) while chat is off. |
| admin-signin-links | PASS | PASS | [1280](pairs/7-setup/admin-signin-links-1280.jpg) · [390](pairs/7-setup/admin-signin-links-390.jpg) | — |
| admin-village | PASS | PASS | [1280](pairs/7-setup/admin-village-1280.jpg) · [390](pairs/7-setup/admin-village-390.jpg) | The placeholder "Saved (paste to replace)" shows whole: at 390 its clientWidth equals its scrollWidth (322). |
| admin-village-nudged | PASS | PASS | [1280](pairs/7-setup/admin-village-nudged-1280.jpg) · [390](pairs/7-setup/admin-village-nudged-390.jpg) | "Nudge sent." |

## 8 · Sign-in, invites, welcome

| Shot | 1280 | 390 | Pairs | Difference or kept reason |
|---|---|---|---|---|
| member-welcome-done-today | PASS | PASS | [1280](pairs/8-signin/member-welcome-done-today-1280.jpg) · [390](pairs/8-signin/member-welcome-done-today-390.jpg) | — Lands on /directory with "You're in. This is the directory." |
| member-welcome-step1-empty | PASS | PASS | [1280](pairs/8-signin/member-welcome-step1-empty-1280.jpg) · [390](pairs/8-signin/member-welcome-step1-empty-390.jpg) | — Community prefills "Nadia Cole" because my invite line had the name. |
| member-welcome-step1-error | PASS | PASS | [1280](pairs/8-signin/member-welcome-step1-error-1280.jpg) · [390](pairs/8-signin/member-welcome-step1-error-390.jpg) | — |
| member-welcome-step2-privacy | PASS | PASS | [1280](pairs/8-signin/member-welcome-step2-privacy-1280.jpg) · [390](pairs/8-signin/member-welcome-step2-privacy-390.jpg) | — |
| public-404 | PASS | PASS | [1280](pairs/8-signin/public-404-1280.jpg) · [390](pairs/8-signin/public-404-390.jpg) | — 404, "Not found · Northwind Founders". |
| public-first-admin-link | PASS | PASS | [1280](pairs/8-signin/public-first-admin-link-1280.jpg) · [390](pairs/8-signin/public-first-admin-link-390.jpg) | — Fresh install: "Sign in to Your community / Signing in as dana.whitfield@example.com / Sign in". The spine green tile and button match Founderhall's. The community name is data (Founderhall's reference had set "Harbor Ventures"). |
| public-invite-join | PASS | PASS | [1280](pairs/8-signin/public-invite-join-1280.jpg) · [390](pairs/8-signin/public-invite-join-390.jpg) | — |
| public-invite-join-fresh | PASS | PASS | [1280](pairs/8-signin/public-invite-join-fresh-1280.jpg) · [390](pairs/8-signin/public-invite-join-fresh-390.jpg) | — Fresh install: "Join Your community / You were invited as sam.lee@example.com / Accept and sign in / Next: two questions…". The colours match. The name and email are data. |
| public-signin-bad-link | PASS | PASS | [1280](pairs/8-signin/public-signin-bad-link-1280.jpg) · [390](pairs/8-signin/public-signin-bad-link-390.jpg) | — 410, "Link not valid · Northwind Founders". The words match. |
| public-signin-default | PASS | PASS | [1280](pairs/8-signin/public-signin-default-1280.jpg) · [390](pairs/8-signin/public-signin-default-390.jpg) | — (kept: "Sign in with a password") |
| public-signin-error | PASS | PASS | [1280](pairs/8-signin/public-signin-error-1280.jpg) · [390](pairs/8-signin/public-signin-error-390.jpg) | — |
