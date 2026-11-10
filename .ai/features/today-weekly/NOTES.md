# Today home and the weekly email: how it works today

- `src/shell/today.ts` reads one member's week across asks, intros and members. The home page (`src/app/(app)/page.tsx`
  with `shell/today-list.tsx`) and the weekly email both use it, so they can't disagree.
- The weekly email is a shell job (`shell/scheduled-jobs.ts`, every 5 minutes). `platform/weekly-email/schedule.ts`
  names the week by the local date of the last scheduled moment. Each member gets a `weekly_email` row per week
  (`queued`, `empty` or `not_wanted`), written in the same transaction as the outbox email, so a stopped run resumes.
  A member who got one in the last 6 days, or who joined after the moment, is skipped.
- Numbered items (asks, then intros waiting for a yes) are stored on the row. Answers go through
  `shell/weekly-email-answers.ts`: a signed link opens `/weekly` (GET only reads), its button posts to
  `/api/email/weekly-answer`; a reply to the signed `reply+<id>-<sig>@RESEND_REPLY_DOMAIN` address arrives as
  Resend's `email.received` event on `/api/email/resend-webhook`, must come from the member's own address, and its
  body is read from Resend's received-email API when the event has none. `weekly_email_action` makes each item
  answerable once; a failed answer releases its claim.
- Admin: `/admin/weekly-email` (schedule, preview from the admin's own week or `buildSampleItems`, test to self).
- Profile lines to confirm: the section exists in `TodayItems` but stays empty until filled-in profile data exists.
