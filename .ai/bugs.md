# Bugs

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: the follow-ups recorded by the merge builds (`.ai/features/*/NOTES.md`, `.ai/features/*/CHARTER.md`) and
> the preview of the merged app on 2026-11-10. Each open line also has a roadmap line (`.ai/roadmap.md`).

Append-only. `date · slug · symptom · root cause · fix commit/PR · repro test`.

- 2026-11-10 · chat-perks · Opening Perks from the in-app menu skips the Perks page's own security policy · the menu entry uses client-side navigation, so the /perks CSP header from next.config.mjs never applies (the Today card and admin link use a full page load) · open · none yet
- 2026-11-10 · chat-perks · Slack /ask gives no follow-up when posting the ask takes more than Slack's 3 seconds · the command answers only inside Slack's first reply window · open · none yet
- 2026-11-10 · small-gaps · On sign-in, switching to the password form clears the typed email, and the empty field blocks sign-in with no message · not yet investigated · open · none yet
- 2026-11-10 · two-sided-intros · A person who said "no thanks" on one link and later stopped all intro asks sees "You've stopped intro requests" on the first link too · not yet investigated · open · none yet
- 2026-11-10 · platform · A switched-off module's pages answer 200 with an "off" notice, not 404 · not yet investigated · open · none yet
- 2026-11-10 · intros · A connector who said no still shows in the asker's paths list · not yet investigated · open · none yet
- 2026-11-10 · small-gaps · The single invite form has no cohort field (only the list and CSV import carry a cohort) · not in that build's scope · open · none yet
- 2026-11-10 · asks-helpers · A member emailed as a helper for an ask doesn't see it on Today or in the weekly email · not yet investigated · open ([PR #22](https://github.com/VillageHQ/community/pull/22)) · none yet
- 2026-11-10 · asks-helpers · "Can help with" matching pairs members on a common word such as "first" · the stop-word list in `src/modules/asks/reads.ts` misses everyday words such as "first" · open ([PR #22](https://github.com/VillageHQ/community/pull/22)) · none yet
- 2026-11-10 · today-weekly · With the feed on, the "fill in your profile?" card sits under the Today list on phones · the card sits in the feed column, which comes after the Today list on a phone (src/app/(app)/page.tsx) · open · none yet
- 2026-11-10 � intros � Declining an intro with the note left empty fails with "Invalid input: expected string, received null" � the card sends `reason: null` (src/modules/intros/components/ask-for-you-card.tsx) but `declineReasonSchema.default(null)` (src/modules/intros/contract.ts) only fills a missing value � open � none yet (found by the demo-mode verifier)
- 2026-11-10 · intros · FIXED: declining with the note left empty failed · `declineReasonSchema` took no null · fix-intros (accepts null) · `intros.test.ts` "declines with the note left empty, as the browser sends it"
- 2026-11-10 · intros · FIXED: a connector who said no still showed in the asker's paths list · the paths read only open asks · fix-intros (an ask that ended in a no hides that connector for that asker and person) · `intros-consent.test.ts` "a connector who said no"
- 2026-11-10 · two-sided-intros · FIXED: the "no thanks" link later said "stopped intro requests" · the answer was read back from the opt-out list, not saved per intro · fix-intros (`target_answer`) · `intros-consent.test.ts` "a link answered no thanks, opened again after a later stop-all"
- 2026-11-10 · intros · FIXED: a yes on a forwarded link never sent the joint email, so the intro waited on "Mark as introduced" · the app had no address for the person asked · fix-intros (the yes page asks for it when email is on) · `intros-consent.test.ts` "a forwarded link…"
- 2026-11-10 · intros · FIXED: unanswered intros went quiet (no connector reminder, no expiry email) · not built · fix-intros (`quiet-intro-emails.ts`, two jobs) · `intros-consent.test.ts` "an intro nobody answers"
