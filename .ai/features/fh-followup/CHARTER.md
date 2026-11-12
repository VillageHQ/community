# Founderhall transplant — follow-up after the owner's review (approved 2026-11-12)

The owner reviewed the round-4 pairs on 2026-11-12. This page is the approved Charter; one pull request.

## Decisions
1. **The result is accepted.** Fix the small gaps left, in this one pull request.
2. **A join from the emailed invite link counts as a confirmed email.** The person who opens the invite link that was
   emailed to them is marked email-confirmed and gets no second "confirm your email" message. A COPIED invite link
   (shared by hand, not opened from the email) still asks for confirmation, as today. Founderhall's flow is the model.
3. **The members' job board starts ON everywhere nobody chose.** New installs AND existing communities whose admin
   never set it. A community whose admin explicitly switched it off stays off. The PUBLIC job board stays off by default.

## Gaps to fix (from the round-4 check)
- Ask page "I can help" card: 18 px above "Offer help" (was 12).
- "Through" card on the intro ask page: 2 px too tall.
- "Open the intro thread" / "with Marcus copied" words follow the real reply-by-email setting.
- Empty "Our jobs" form (no hiring tool linked): Founderhall's form.
- Fresh-install Village page: prefill the service email like Founderhall; show the terms date field like Founderhall.
- Phone, fresh-install mail-off page: no "example.co / m" split.
- Email log: the first email to the person asked is filed under its real kind, not "reminder".
- "Last pulled" on Our jobs: the app's date style.

## Proof
Typecheck, lint, the full suite on a throwaway Postgres; tests for decisions 2 and 3; a separate foreground checker
retakes every affected screen at 390 and 1280 beside Founderhall and clicks through both behaviours on the demo seed
(max 2 repair rounds). Pairs in `reports/`.

## Limits
Nothing beyond decision 2 in sign-in or security. No real accounts, email or services.
