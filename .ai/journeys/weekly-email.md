# Journey: the weekly email

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `.ai/features/today-weekly/NOTES.md`, `src/shell/weekly-email.ts`, `src/shell/weekly-email-answers.ts`,
> `src/app/weekly/`, `src/app/(app)/admin/weekly-email/`.

Who: every member (mostly on a phone, in their inbox) and the admin who sets the schedule.

1. The admin sets the day, hour and time zone on `/admin/weekly-email` (default Thursday 09:00), previews it from
   their own week or a made-up sample, and sends a test to themself.
2. At that moment each member gets one email with numbered items: asks they could help with, then intros waiting
   for their yes. A member with nothing that week gets none.
3. They answer an item by its signed link → `/weekly` shows the item and a button (opening the link changes
   nothing); or they reply to the email, which arrives through the inbound email webhook.
4. Each item can be answered once; the same items leave Today.
5. They can turn the weekly email off on their card (`/members/card`) or with the one-click unsubscribe link.

Tests: `src/shell/weekly-email.test.ts`, `src/platform/weekly-email/weekly-email-rules.test.ts`.
