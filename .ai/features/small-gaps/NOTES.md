# The smaller gaps: how it works today

- **Profile lines.** `member_profile.stage`, `sector`, `cohort` (free text, at most 80 characters). Accepting an invite
  copies `invite.cohort` onto the card. The directory filters each as a whole value ignoring case and outer spaces;
  "updated" uses `member_profile.updated_at` (a member who never saved a card has none, so never matches). The menus
  list the values active members use (`filterOptions`).
- **Report by cohort.** `readIntroReport` adds `byCohort` (by the asker's cohort) per period; the community section
  adds "Members in <cohort>". The section appears only when a cohort exists.
- **Reminder to the person asked.** Job `intro-target-reminders` (every 15 minutes). Due: waiting on the target
  (`isAwaitingTarget`), an address on the intro, emailed by the app at least 4 days ago (`consent_email_at`), and
  `target_reminder_at` empty. One transaction claims it, saves a new consent link and queues the email (dedupe key
  `intro-target-reminder-<id>`). A claimed row is never claimed again.
- **Email check.** `src/platform/email/dns-check.ts` reads the domain from `RESEND_FROM_ADDRESS` and looks up SPF on
  `send.<domain>`, DKIM at `resend._domainkey.<domain>`, DMARC on the domain or its parent. A lookup that fails is
  "No answer", never "Missing". "Send a test to me" queues kind `email_test` to the admin's own address.
- **Village settings.** Instance settings `village_search_scope`, `village_introducers`,
  `village_chosen_introducer_ids` (JSON), `village_service_email`. "Everyone" sends `scope: "global"` and keeps those
  results; they name no path. "Chosen" drops paths whose introducer is a non-chosen member (paths through
  non-members stay) and refuses "I know someone" from a non-chosen member.
- **Follow-ups.** `email_outbox.expires_at`: the sender skips a row past it. Sign-in and reset emails expire a minute
  before their link. `next_attempt_at` defaults to `date_trunc('milliseconds', now())`: the rounded default put rows
  up to half a millisecond in the future, which made the one-click header test flaky.
