# Two bugs found in the preview (wave 3)

Approved scope (the owner's build plan, wave 3). No migration.

## 1. The helper email and the Today list disagree
A helper got the "you could help with this ask" email, but the ask did not show on their Today home under
"Asks you could help with". Find why, and make both use the same matching, so every helper who is emailed sees the
ask on Today.

## 2. Matching on everyday words
Helper matching paired members on a common word ("You said you can help with first"). Stop words and very common
words never make a match (a stop-word list plus a minimum word length), and the shown reason names a real
overlapping skill or topic.

## Acceptance (made-up members)
- An ask that emails 3 helpers shows on the Today home of exactly those 3.
- Asks whose only overlap is a common word ("first", "with", "help", "team") match nobody.
- A real overlap ("fundraising", "pricing") still matches, and the reason line names it.

## Tests
A failing test first for each bug, in `src/modules/asks/asks-helpers.test.ts` and
`src/platform/weekly-email/weekly-email-rules.test.ts`, then the fix. Plus lint, typecheck and the architecture tests.
