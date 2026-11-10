# Journey: Today, the member's home

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `.ai/features/today-weekly/NOTES.md`, `src/app/(app)/page.tsx`, `src/shell/today.ts`, `src/shell/today-list.tsx`.

Who: a member opening the app, often from a link in an email.

1. The member opens `/` → "Good to see you, <name>." and either "Here's what needs you this week." or "Nothing
   needs you this week."
2. They see only what needs them: asks they could help with (and why they are seeing them), intros waiting for their
   yes, intros they said yes to and still need to finish, their own asks in motion, new members, and next steps
   (fill in your card, connect your network; setup steps for admins).
3. They act on an item in place (answer, offer help, open the intro) or tap "Not for me" on an ask → it leaves Today
   and the weekly email for them.
4. When everything is handled → "That's everything this week."
5. With the feed switched on, the same list sits beside the feed (above it on a phone). Perks shows a card when the
   Perks module is on.

The weekly email reads the same list (`readTodayItems`), so the two never disagree ([weekly-email.md](weekly-email.md)).
Tests: `src/shell/weekly-email.test.ts`, `src/modules/asks/asks-helpers.test.ts`.
