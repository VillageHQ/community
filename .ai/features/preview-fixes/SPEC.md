# Preview fixes (wave 3)

Two fixes to asks helpers (see `../asks-helpers/SPEC.md`):

- The helper email and the Today list "Asks you could help with" use one word-matching rule
  (`src/modules/asks/rules-help-match.ts`). Every member emailed about an ask also sees it on Today, with the reason
  it was sent; updates never show there.
- Stop words and everyday words ("first", "with", "help", "team", "quick", "tips"…) never make a match, and the reason
  names only the shared words ("Can help with fundraising, pricing").
