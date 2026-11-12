# fh-followup: independent check (commit 7f09440, 2026-11-12)

The checker ran a production build on throwaway Postgres: `app_fresh` (fresh install with a fake Resend and a fake
Village) and `app_check` (demo seed). Each pair image has Founderhall on the left and Community on the right, JPEG.
The demo adds a 34 px banner at the top, so Community's demo screens sit 34 px lower.

| Pair | Verdict | Why |
|---|---|---|
| [member-ask-detail-1280](pairs/member-ask-detail-1280.jpg) · [390](pairs/member-ask-detail-390.jpg) | PASS | Textarea bottom to "Offer help" top is 18 px at both widths (1280: 585 to 603; 390: 1210 to 1228 CSS px). Allowing for the banner, the button is at 569–609 against Founderhall's 570–610. |
| [member-intro-ask-from-profile-1280](pairs/member-intro-ask-from-profile-1280.jpg) · [390](pairs/member-intro-ask-from-profile-390.jpg) | PASS | The "Through · Ada Okafor" card is the same height as Founderhall's. Border rows: 1280 FH 278→342 against CM 312→376 (both 64 px). 390 at DPR 2: FH 620→748 against CM 724→852 (both 128 px). |
| [public-intro-decide-target-replies-off-1280](pairs/public-intro-decide-target-replies-off-1280.jpg) · [390](pairs/public-intro-decide-target-replies-off-390.jpg) | PASS | Fresh install, replies off: "We email you and Ben to introduce you." The word "copied" is nowhere, and the email says the same. |
| [public-intro-decide-target-replies-on-1280](pairs/public-intro-decide-target-replies-on-1280.jpg) · [390](pairs/public-intro-decide-target-replies-on-390.jpg) | PASS | Replies on: "One email to you and Ben, with Cara copied." These are Founderhall's words. |
| [public-intro-decide-target-yes-done-replies-off-1280](pairs/public-intro-decide-target-yes-done-replies-off-1280.jpg) | PASS | "Check your email: we’ve introduced you to Ben. Reply to it to write to Ben." Two separate emails went out, each with reply-to set to the other person. |
| [public-intro-decide-target-yes-done-replies-on-1280](pairs/public-intro-decide-target-yes-done-replies-on-1280.jpg) | PASS | "Check your email: one message to you and Ben, with Cara copied." One `intro_thread` row was made. |
| [public-intro-decide-connector-yes-done-replies-off-1280](pairs/public-intro-decide-connector-yes-done-replies-off-1280.jpg) | PASS | Thank-you line: "…If Lena says yes, we email Ben and Lena to introduce them." |
| [public-intro-decide-connector-yes-done-replies-on-1280](pairs/public-intro-decide-connector-yes-done-replies-on-1280.jpg) | PASS | Thank-you line: "…one email introduces Ben and Hana, with you copied." |
| [member-me-profile-new-1280](pairs/member-me-profile-new-1280.jpg) · [390](pairs/member-me-profile-new-390.jpg) | PASS | "Our jobs" has Company and Hiring tool side by side, the Careers link with Founderhall's hint, and one "Pull our jobs" button. Other tool with no link adds a hand-added company. Greenhouse with a junk link shows a plain error. |
| [member-me-profile-1280](pairs/member-me-profile-1280.jpg) · [390](pairs/member-me-profile-390.jpg) | PASS | Sam (Tallyhealth/Ashby) sees "Last pulled 12 Nov 13:14 UTC · from Ashby…". |
| [admin-first-village-not-connected-1280](pairs/admin-first-village-not-connected-1280.jpg) · [390](pairs/admin-first-village-not-connected-390.jpg) | PASS | Service email is filled in with the first admin's address. The date field under "Members agreed in our membership terms on" shows while Off is chosen. Founderhall uses `+village` in the address; the brief asked for the first admin's address. |
| [admin-first-invites-mail-off-1280](pairs/admin-first-invites-mail-off-1280.jpg) · [390](pairs/admin-first-invites-mail-off-390.jpg) | PASS | In the "Send the sign-in links yourself" rows, every address stays on one line and is cut with "…" ("jo.kim@ex…", "samuel.lee…"). None is split. The rows are only 99 CSS px wide at 390, so even short addresses get cut. The 390 shot is the state just after inviting. Founderhall's is the page as it loads. **Re-check after the repair to `admin/invites/page.tsx`:** after a rebuild, with mail off on the fresh install, the grey line under every "Waiting to sign in" row (12 rows, including "alexandra.whitfield-brown@…" and "nadia.okonkwo-fernandez@…") is one line, 18 px high, `nowrap` + `ellipsis`, cut with "…", at both 390 and 1280. No address is split. Both pairs were retaken. |
| [admin-mail-1280](pairs/admin-mail-1280.jpg) · [390](pairs/admin-mail-390.jpg) | PASS | The first email to the person asked is filed as `intro_target_ask` (rosa.lindqvist@example.com), and the outbox kind matches. |

## Behaviours (fresh install, fake mail)
- **A. Emailed invite link confirms the address: PASS.**
  - Ben clicked the link inside the recorded email HTML. He came out confirmed, got no "Confirm your email" message, and has no Today card. His admin page says "ben.carter@example.com is confirmed."
  - Ada's link had a broken mark (`&amp;e=`), which acts like a copied link. She came out unconfirmed and got the confirmation email.
  - Cara, with one character of the mark changed: unconfirmed, and the confirmation email was sent.
  - Dev, with Ben's mark on Dev's token: unconfirmed, the confirmation email was sent, and Today shows "Check your email to confirm it's you".
  - Reusing Ben's link shows "That link doesn’t work any more".
  - Opening Eve's emailed link while signed in as Ada: "Sign out and continue" keeps the mark, and Eve came out confirmed with no confirmation email.
- **B. Job board on by default: PASS.**
  - Fresh install: the member nav has Jobs, `/jobs` works, `/admin/jobs` shows the Job board page with "Public job board: Off", and the console menu has Job board.
  - Signed out, `/jobs` redirects to `/signin` and `/api/job-board/embed` answers 404.
  - After an admin switched Jobs off and the server restarted, `/jobs` says "That page isn’t here", the nav has no Jobs, and `/admin/jobs` answers 404.
