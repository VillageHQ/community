# Independent check: fix-intros-reports (2026-11-12)

I ran build `846ff2b` (`pnpm start` on the existing `.next`) on port 56650, with its own Postgres container
(`pg-verify-fir`, 127.0.0.1:56655, now removed). The repo's fakes stood in for outside services: `src/test/fake-village-server.ts`
pinned to port 56653 behind a proxy on 56652 that can simulate an outage, and a fake Resend on 56651 that writes every
email to `.ai/tmp/verify/mails.jsonl`. Every step ran in the foreground as one node process: start the fakes, start the
app, run the step, stop everything. The scripts are in `.ai/tmp/verify/` (gitignored). All people are made up and use
@example.com addresses.

Seed: Dana (admin), plus Amara, Jonas, Marcus, Priya, Ada, Sam and Elena, who were invited by email, accepted and
confirmed by the admin. Uma accepted but her email is still unverified. Network, intros and asks are on; the Village
keys are the fake ones; a Village group was created. Where I moved data in the database, as the earlier tester did:
two intros got `expires_at` in the past and then the `intro-expiry` job ran; two Village ledger rows were moved 3 days back
so the per-day table has more than one row; `console_launched_at` was set so console Home shows the dashboard.

Screenshots are JPEGs in this folder. Files named `sbs-*.jpg` put this build beside the Founderhall reference.

---

## 1. PRIV-07: "Credit me in reports" — PASS

What I did:
- Opened Jonas's `/me/data` at 1280 and 390 px, turned the switch on, pressed Save and reloaded.
- Opened `/admin/report` as the admin.
- Emulated print media and saved a PDF.
- Downloaded the CSV through `POST /api/admin/partner-report/csv`.
- Fetched the preview, opened `/admin/report/send`, and sent the report to partner.one@ and partner.two@example.com.
- Tried to get a name out the other way round: turned credit on for Priya, then had the admin remove her.

What I saw:
- **The switch.** "Credit me in reports" sits under Your switches with its hint and is off by default (`aria-checked=false`). After Save and a reload it stays on. The database has `credit_in_reports=t` for Jonas only, and the consent record now reads "Named in partner reports: yes". No overflow at 390 px.
- **The admin's page** names every connector: Jonas Berg; Ada Okafor and Priya Shah, each marked "not named to partners". A line explains that partners see only credited names.
- **The printed page** shows only "Jonas Berg 3 3 1" and "Other connectors 5 1 0". It does not contain Priya, Ada or "not named".
- **The CSV** has two connector rows: `Top connectors,Jonas Berg,…` and `Top connectors,Other connectors,5,…`. No uncredited name.
- **The preview, the send page and both emails the fake mail server caught** list only "Jonas Berg: 1 introduced…" and "Other connectors: 0 introduced, 1 yes of 5 asked". No uncredited name.
- **Removal.** With Priya credited, the CSV named her. Once the admin removed her, the CSV folded her back into Other connectors, and the since-launch preview no longer named her.

Evidence:
- `priv07-yourdata-off-1280.jpg`, `priv07-yourdata-off-390.jpg`, `priv07-yourdata-on-1280.jpg`, `priv07-yourdata-on-390.jpg`
- `priv07-report-page-1280.jpg`, `priv07-report-page-390.jpg`, `priv07-report-print-1280.jpg`, `priv07-send-page-1280.jpg`
- `priv07-partner-email.txt`, `adm04-partner-report.csv`
- `sbs-priv07-yourdata-on-1280.jpg`, `sbs-priv07-report-page-1280.jpg`

## 2. ADM-04: no-answer expiries apart from declines — PASS on the partner report; console Home still counts them as declines (finding F2)

Data: 8 intros. 1 made. 2 declined (1 by the connector, 1 by the target). 2 expired with no answer (1 at the connector,
1 at the target). 3 still open.

What I saw:
- **Page ledger.** Declined 2 ("1 at the connector, 1 by the person asked for"), then its own row: No answer in 7 days 2 ("1 at the connector, 1 with the person asked for"). "The no's, too" says "2 had no answer in 7 days and are not counted as declines".
- **Title and email subject.** "Your intros, Q4 2026 to date: 8 asked, 1 made, 2 declined".
- **Email text.** "Declined: 2 (…)" and "No answer in 7 days: 2 (…)". The breakdown lines say "2 declined, 2 no answer, 3 open".
- **CSV measures.** Declined at the connector 1, Declined by the person asked for 1, No answer in 7 days 2, Withdrawn 0, Still open 3, Introduced 1. These add up to 8, the number of asks.
- **CSV breakdown rows** have a new "no answer" column, and every row adds up. Jonas 3 = 1+1+0+1. Other connectors 5 = 0+1+2+2. Not set 8 = 1+2+2+3.
- **What still gets it wrong:** console Home says "8 asked, 1 made, **4 declined**" and "Declined 4: 2 by connector, 2 by target" (F2). On the report page and in print, the By sector, By need and By cohort tables have no "No answer" column, so 8 ≠ 1+2+3 there (F5).

Evidence: `priv07-report-page-1280.jpg`, `priv07-report-print-1280.jpg`, `adm04-partner-report.csv`, `priv07-partner-email.txt`, `net09-home-out-of-credits-1280.jpg` (the Home ledger).

## 3. NET-09: admins told once when Village runs out of credits or goes down — PASS (at most one email per day per kind, by design)

**Out of credits.** I set the fake to answer 402 on `/v2/people/search`. Then 5 searches ran in parallel from 3 members, and 3 more ran one after another.
- Every search returned 502 `village_out_of_credits` with the friendly message. In the member UI (390, a new query) the message reads "Lookups are paused for now. This community has run out of Village credits… you don't need to do anything" with a Check again button.
- The admin got **exactly 1** email: "Your community: Village is out of credits", with a link to Admin › Village.
- Console Home shows "Village is out of credits: lookups are paused" at 1280 and 390. Admin › Village says "Village said the credits ran out on 12 Nov. Top up at Village".
- The next search that worked cleared `village_out_of_credits_at`.

**Down.** I made the proxy drop every connection and ran 5 searches.
- Each returned 502 `village_unavailable`: "Village isn't responding right now. Try again in a moment."
- The admin got **exactly 1** email: "Your community: Village isn't answering".
- Home shows "Village isn't answering".
- After Village came back, one search cleared `village_trouble`.

**A second spell on the same day** (down again, and out of credits again) sent no email. The code limits each kind to one
email per 24 hours. That is reasonable, but the charter says "once per spell", so see F7.

Evidence:
- `net09-home-before-1280.jpg`, `net09-home-before-390.jpg`
- `net09-home-out-of-credits-1280.jpg`, `net09-home-out-of-credits-390.jpg`
- `net09-admin-village-ooc-1280.jpg`, `net09-admin-village-ooc-390.jpg`
- `net09-member-out-of-credits-390.jpg`
- `net09-home-down-1280.jpg`, `net09-home-down-390.jpg`, `net09-member-down-390.jpg`
- `sbs-net09-home-out-of-credits-1280.jpg`
- The email texts are in `.ai/tmp/verify/mails.jsonl`.

## 4. NET-12: credits per day and per member, last 30 days — PASS

After searches by Sam, Amara and Elena, Sam's path lookups and one admin fill-in run, Admin › Village (under Latest
lookups) shows two tables:
- "Per day, last 30 days": 12 Nov, 6 lookups, 42 used; 9 Nov, 2 lookups, 14 used. Each row has a bar.
- "Per member, last 30 days": Sam Lee 10 / 70, Amara Diallo 2 / 14, Elena Rossi 2 / 14, and "Profile fill-in (the portal itself)" 1 / 1.

Both tables read cleanly at 390 px with no overflow. One small point on wording: these tables use "Lookups" for the
number of calls, while Home says "56 lookups used this month" meaning credits (F8).

Evidence: `net12-admin-village-1280.jpg`, `net12-admin-village-390.jpg`, `net12-credit-tables-1280-view.jpg`, `net12-credit-tables-390-view.jpg`, `net12-with-fill-in-1280-view.jpg`, `sbs-net12-credit-tables-1280-view.jpg`.

## 5. INTRO-06: the member who is asked for answers in the app — PASS (with UX findings F4 and F6)

What I did:
- I1: Amara asked Jonas from his profile in the UI, for an intro to Marcus Webb. The asker's form has no email field (F9). Jonas said "Yes, introduce them" on the intro page and typed Marcus's member email.
- I3: Sam asked Jonas through the API, giving Marcus's email (`target.email`, stored as `suggested_target_email`). Jonas said yes without typing an email.
- I2: Amara asked Jonas for Uma (unverified email). Jonas said yes with Uma's address.

What I saw:
- **Marcus's Today** (1280 and 390): "Marcus, 2 intros are waiting for your yes". Under "Waiting for your yes" there are two cards, "Jonas Berg would like to introduce you to Sam Lee" and "…to Amara Diallo". Each shows the asker's headline, "Asked just now. Sam hears nothing unless you say yes.", the note, and "Yes, introduce us" / "No thanks".
- **Your intros** shows the same cards under "Waiting for your answer".
- **The Intros badge** reads 2.
- **Answering works.**
  - Yes on Your intros moved I1 to `completed`. The joining email "Amara ↔ Marcus, via Jonas" went to marcus.webb@example.com and to Amara. Jonas got "Marcus said yes, and they're connected".
  - No thanks on Today moved I3 to `target_declined`. Sam got "They can't make this one" and Jonas got "Intro to Marcus Webb: closed".
  - After a reload the badge went 2 → 1 → none.
- **Break attempts.**
  - Priya (another member), Amara (the asker), Jonas (the connector) and Uma all posting `member-answer` for I1 got 410 `intro_consent_link_closed`. None of them see the card or a badge.
  - Uma, the unverified person asked for in I2, does not see it and gets 410 when she tries to answer. Marcus answering I2 also gets 410.
  - `stop_all_asks` → 422. Signed out → 401. A second answer after the intro closed → 410 ("nothing you need to do").

Evidence:
- `intro06-marcus-today-1280.jpg`, `intro06-marcus-today-390.jpg`, `intro06-marcus-intros-1280.jpg`, `intro06-marcus-intros-390.jpg`
- `intro06-marcus-after-yes-1280.jpg`, `intro06-marcus-today-after-no-1280.jpg`, `intro06-uma-intros-unverified.jpg`
- `x-jonas-connector-page.jpg`, `x-jonas-after-yes.jpg`
- `sbs-intro06-marcus-today-1280.jpg`, `sbs-intro06-marcus-intros-1280.jpg`

## 6. ASK-06: ask a helper found by profile words — PASS for the brief; a data bug in the prefill (F3)

What I did:
- Sam posted an ask: "Looking for a hardware supply chains contact in Shenzhen for our sensor", naming Li Wei at Shenzhen Parts Co.
- Ada was listed as a helper because of her profile words ("Their profile says they can help with 'Hardware supply chains in Shenzhen.'").

What I saw:
- On Sam's ask page, "Ask Ada for an intro" is enabled at 1280 and 390.
- Clicking it opens "Who would you like Ada to introduce you to?" and "A note Ada can forward".
- Submitting went to `/intros/<id>`. The intro row has `state=requested`, connector Ada Okafor, and `ask_id` set to the ask.
- **Break attempts.**
  - Sam asking Marcus (not listed) → 404 `ask_not_helper` ("isn't listed as able to help with this ask").
  - Elena (not the author) asking Ada on Sam's ask → 404.
  - A blank name → 422 "Add their name".
  - The exact same name again → 409 `intro_duplicate`.
- **But the box is prefilled "Li Wei · Shenzhen Parts Co"**, the ask's name and company joined. That string is sent as the person's name, so the intro is stored as `target_name = "Li Wei · Shenzhen Parts Co"` (F3). Because the name differs, asking again with just "Li Wei" made a second open intro to Ada for the same person; the duplicate check did not catch it.

Evidence: `ask06-helper-button-1280.jpg`, `ask06-helper-button-390.jpg`, `ask06-helper-form-1280.jpg`, `ask06-helper-form-390.jpg`, `ask06-after-submit-1280.jpg`, `sbs-ask06-helper-form-1280.jpg`.

## 7. PROF-04: filled-in face on an outside host — PARTIAL

What I did:
- Set fill-in to "ask", Ada said yes, and the admin ran fill-in.
- The fake stored `face = https://images.example.com/ada-okafor-x.jpg`.

What I saw:
- **Server HTML.** The HTML of `/directory` and `/people/<ada>`, fetched without running scripts, contains `<img src="https://images.example.com/ada-okafor-x.jpg" alt="" …>` inside the avatar, after the "AO" initials. PASS.
- **Initials.** The picture fails to load (blocked, `naturalWidth=0`) and the initials "AO" still show. PASS.
- **No broken-image icon: FAIL.** Chromium draws its broken-image glyph in the top-left of the avatar, over the initials. At the directory's 36 px size it overlaps the "A" (F1). The company logo next to it (an older component) shows the same glyph.
- **Uploaded photo.** After Ada uploaded a PNG, both pages serve `/api/members/<id>/avatar?v=…` and the example.com face is gone. PASS.

Evidence:
- `prof04-directory-1280.jpg`, `prof04-directory-390.jpg`, `prof04-profile-1280.jpg`, `prof04-profile-390.jpg`
- `prof04-avatar-zoom-chromium.jpg`, `prof04-avatar-zoom-profile.jpg`, `prof04-profile-uploaded-1280.jpg`
- `sbs-prof04-directory-1280.jpg`, `sbs-prof04-profile-1280.jpg`

---

## Findings, most severe first

**F1 (medium, PROF-04): a face that fails to load shows Chromium's broken-image icon over the initials.**
1. Give a member a filled face on a host that doesn't answer (images.example.com).
2. Open /directory or /people/<id> in Chrome.
3. A broken-image glyph appears top-left in the avatar, overlapping the initials.

`alt=""` does not hide it in Chromium. The image needs to be hidden when it fails (an `onError` handler, or hidden until it loads). The company logo `<img>` has the same glyph.

**F2 (medium, ADM-04 consistency): console Home still counts no-answer expiries as declines.**
1. Have 1 intro declined by the connector, 1 by the target, and 2 expire with no answer.
2. Open /admin.
3. The heading says "8 asked, 1 made, 4 declined" and Declined reads "2 by connector, 2 by target".
4. The partner report for the same intros says 2 declined.

Admins see two different numbers.

**F3 (medium, ASK-06): the "Who would you like … to introduce you to?" box is prefilled with name and company joined, and that string becomes the intro's person name.**
1. Post an ask naming "Li Wei" at "Shenzhen Parts Co", with a profile-words helper.
2. Press "Ask Ada for an intro". The box reads "Li Wei · Shenzhen Parts Co".
3. Submit. The intro's `target_name` is "Li Wei · Shenzhen Parts Co".

Knock-on effects:
- The intro log and emails read "Sam Lee → Li Wei · Shenzhen Parts Co". At 390 px on console Home that long name runs into the date column (`net09-home-out-of-credits-390.jpg`).
- Asking again with just "Li Wei" makes a second open intro for the same person, because the duplicate check misses it.

The fix is to prefill the person's name only.

**F4 (low, INTRO-06 UX): no confirmation after answering in the app.**
1. As the member asked for, press "Yes, introduce us" (or "No thanks") on Today or Your intros.
2. The card vanishes as the page refreshes.

The "You said yes. Check your email…" / "Thanks for answering…" text is never visible. Separately, the sidebar Intros badge kept showing 2 until a full reload (`intro06-marcus-after-yes-1280.jpg`).

**F5 (low, ADM-04): the page and print breakdown tables have no "No answer" column.**
1. Open /admin/report with expired intros.
2. By sector, By what the founder needed and By cohort show Asked 8, Made 1, Declined 2, Open 3, so the row doesn't add up.

The CSV and email do add up. Top connectors on the page shows only Asked / Yes / Introduced.

**F6 (low, INTRO-06 / existing): the connector page tells the connector to send a private link even when the app already emailed a member.**
1. As Jonas, say yes with Marcus's member email.
2. The page says "Send Marcus this private link, however you normally reach them".

The app already emailed Marcus, and he can now answer on Today. This was already flagged in the audit (INTRO-06 note) and is still there.

**F7 (low / decision): a second spell of Village trouble on the same day sends no email.**
1. Out of credits, then recover, then out of credits again within 24 h. Or down, then up, then down.
2. The first spell sends 1 email; the second sends none.

Home still shows the notice. The code says "at most once a day"; the charter says "once per spell". This is fine if intended.

**F8 (cosmetic, NET-12): "lookups" means two things.**
1. Compare console Home's "56 lookups used this month" (credits) with Admin › Village's tables, where "Lookups" is calls and "Used" is credits.

**F9 (observation, INTRO-06): the asker can't give the person's email in the UI.**
1. The profile ask form (/intros/new?via=) has Name / Role / Company only.

So a member target is reached only when the connector types the email (the API does accept `target.email`). Nothing in the UI picks a member from the directory either, although the charter mentions that.

## Clean-up
- Every app server and fake ran inside one foreground node process per step and was stopped at the end of it (`taskkill /T`).
- Ports 56650–56669 have no listeners.
- The container `pg-verify-fir` is removed. `pg-fix-intros-reports` was not touched.
- No tracked file was changed.

---

## Re-check (commit 6f24ac6, 2026-11-12)

How I ran it:
- Same rules as before, on a fresh build: `.next/BUILD_ID` is from 21:08:45, after the commit at 21:08:13.
- A new container, `pg-verify-fir2` (now removed), seeded from scratch with the same made-up people. Both fakes again.
- One foreground session: `.ai/tmp/verify/r1.mjs`.
- Intros used: Amara→Jonas→Marcus (Jonas typed Marcus's email); Sam→Jonas→Marcus (Sam gave the email); Sam→Priya, declined by Priya; Elena→Priya and Elena→Ada (Ada said yes and typed Rita's email). The last two expired with no answer after a database date move and the expiry job.
- Sam's sector was set to Fintech so the By sector table has two rows.

| # | Verdict | What I saw | Evidence |
|---|---|---|---|
| F1 | **PASS** | **Server HTML:** /directory and /people/<ada> still contain `<img src="https://images.example.com/ada-okafor-x.jpg">`. **Host that refuses** (DNS failure, Chrome, 390 and 1280, zoomed ×3): the `<img>` is removed from the avatar and only the "AO" initials show, with no broken-image icon on either page. **Host that never answers** (request left hanging): the `<img>` stays but draws nothing, and the initials show. **Uploaded photo:** after Ada uploads a PNG, the page serves `/api/members/<id>/avatar` (loads, 128 px) and the outside face is gone. The company logo beside the role line still shows Chrome's broken icon (R2). | `rc-f1-fail-*-zoom.jpg`, `rc-f1-hang-*-zoom.jpg`, `rc-f1-directory-{1280,390}.jpg`, `rc-f1-profile-{1280,390}.jpg`, `rc-f1-uploaded-profile-1280.jpg` |
| F2 | **PASS** | **Console Home** (1280 and 390): "7 asked, 1 made, 2 declined". **Ledger:** Declined 2 ("1 by connector, 1 by target"), then its own row "No answer in 7 days 2", then Still open 2. **Partner report title:** "7 asked, 1 made, 2 declined". **CSV:** Declined 1+1, No answer 2. The two match. | `rc-f2-home-1280.jpg`, `rc-f2-home-390.jpg` |
| F3 | **PASS** | **Prefill:** "Li Wei" at 390 and 1280, with no company. **The intro:** `target_name = "Li Wei"`, company kept apart ("Shenzhen Parts Co"). **Asking again for the same person to Ada:** the UI shows "You already have an open intro request with this person for this intro." in the form, and the API returns 409 `intro_duplicate`. | `rc-f3-form-390.jpg`, `rc-f3-form-1280.jpg`, `rc-f3-second-ask-refused-1280.jpg` |
| F4 | **PASS** (stale badge remains, R1) | **Your intros, Yes (1280):** the card goes and the flash reads "You said yes. Check your email: we'll introduce you and Amara with one message." It is still there 8 s later. **Today, No thanks (390):** the card goes and the flash reads "Thanks for answering. Nobody is told why, and nothing more is sent about this." **States:** completed and target_declined. One joining email went to Marcus. | `rc-f4-intros-after-yes-1280.jpg`, `rc-f4-today-after-no-390.jpg` |
| F5 | **PASS** | **By sector, By need and By cohort** have a "No answer" column on the page and in print, and every row adds up: Not set 4 = 1+0+2+1; Fintech 3 = 0+2+0+1; Other and No cohort 7 = 1+2+2+2. **At 390** the tables fit. In the need table the header wraps to "No / answer", which still reads. | `rc-f5-report-tables-1280.jpg`, `rc-f5-report-tables-390.jpg`, `rc-f5-report-390-full.jpg`, `rc-f5-report-print-1280.jpg` |
| F6 | **PASS** | **Jonas's page** for both intros (390 and 1280) now says: "We emailed Marcus on Nov 12. They answer from that email, or in the app if they're a member here. Nothing more to send…". It no longer says "Send Marcus this private link". **Not checked:** the "send it by hand" wording for a connector who gave no email. That attempt (`/api/intros/answer` yes with no email and none from the asker) returned 422, so the branch didn't come up. | `rc-f6-connector-i1-390.jpg`, `rc-f6-connector-i3-1280.jpg` |

### Left over or new (all low)

**R1 (low, left from F4): the sidebar and tab bar Intros badge doesn't refresh after an in-app answer.**
1. Marcus has 2 target cards.
2. He answers one on Your intros. The badge stays at 2.
3. He answers the other on Today. The badge shows 1, though nothing is waiting.

A full page load corrects it.

**R2 (low, existing): the company logo `<img>` still shows Chrome's broken-image icon when its host fails.**
1. Open /people/<ada> or /directory with images.example.com unreachable.
2. The 16–20 px logo before "Founder, Gridwise Energy" shows the broken-image glyph.

This is the `company-logo` component, outside the face fix.

**R3 (cosmetic): two date styles on the connector's page.**
1. Open the connector's intro page after the app emailed the person.
2. The new line says "on Nov 12" and "closes on Nov 19"; the same page says "You answered on 12 Nov."

### Re-check clean-up
- The app and the fakes ran inside one foreground process and were stopped at its end.
- Ports 56650–56669 have no listeners. The container `pg-verify-fir2` is removed.
- The only files changed are new `rc-*.jpg` screenshots and this section.
