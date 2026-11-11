---
id: asks-tools
status: built
waits-on: []
size: medium
touches: ["src/modules/asks/", "src/shell/admin-asks.ts", "src/app/(app)/admin/asks/"]
checks: ["src/modules/asks/asks.test.ts", "src/modules/asks/rules.test.ts"]
---
# Spec: asks board tools and Admin › Asks

**Added:** 2026-11-11, the owner's pick from the Founderhall merge plan. It builds two parity specs:
`.ai/features/asks-board-tools/SPEC.md` (tabs, search, pin, reopen) and the asks page in
`.ai/features/admin-console/SPEC.md`.

## What it does now
- The board has tabs Open, Mine, Answered and Closed, and one search over every ask and its answers, closed ones too.
- Admins pin up to 3 open asks to the top; the author or an admin reopens a closed ask. Both are in the audit log.
- Admin › Asks shows this quarter's counts (asked, answered, closed by outcome), the oldest unanswered open asks,
  the pinned asks, reported asks and answers, and the weekly allowance.

How it works: `NOTES.md`. The approved scope: `CHARTER.md`.

## Open questions
- None known. Follow-ups: the members page's clear-search button (same bug fixed here for asks), and the audit wording
  when members reopen their own ask.
