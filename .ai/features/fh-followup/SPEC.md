---
id: fh-followup
status: in-progress
waits-on: [fh-final-pass]
touches: ["src/app/api/invites/accept/route.ts", "src/app/invite/", "src/modules/members/service-invites.ts", "src/modules/members/service-invite-emailed.ts", "src/modules/job-board/manifest.ts", "src/modules/job-board/components/", "src/modules/intros/components/public-intro.tsx", "src/modules/intros/email-target.ts", "src/platform/email/kinds.ts", "src/modules/network/components/admin-village-forms.tsx", "src/modules/admin/components/invite-sheet.tsx", "src/app/(app)/admin/invites/page.tsx"]
checks: ["src/modules/members/emailed-invite.test.ts", "src/modules/job-board/job-board.test.ts", "src/modules/intros/components/intros-ui.test.ts", "src/shell/disabled-modules.test.ts"]
---
# Founderhall transplant: follow-up after the owner's review (2026-11-12)

What it does now:
- **Joining from the emailed invite link confirms the address.** The invite email's link carries a mark beside its
  token; whoever accepts from it is email-confirmed and gets no "Confirm your email". The link an admin copies has no
  mark, so a join from it still sends the confirmation email (and Today asks to confirm), as before.
- **The members' job board is on wherever no admin chose**, on new installs and on existing communities. An admin who
  switched it off keeps it off. The public board (visible outside the community) still starts off.
- The small gaps from round 4: 18 px above "Offer help" on an ask; the "Through" card on an intro ask is Founderhall's
  height; the person asked and the connector read "copied" only when replies by email are on (the email too);
  "Our jobs" with nothing linked is Founderhall's form (Company, Hiring tool, Careers link, "Pull our jobs"); the
  Village page fills in the service email in use and always shows the terms date field; invite addresses on a phone
  stay on one line, cut with "…"; the first email to the person asked is logged as `intro_target_ask`; "Last pulled"
  reads "12 Nov 10:30 UTC".

Proof: `reports/PAIRS.md` (Founderhall | Community at 390 and 1280 px) and the pull request.
