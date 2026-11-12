---
id: fh-console
status: in-progress
waits-on: [fh-foundation]
touches: ["src/app/(app)/admin/", "src/app/api/admin/", "src/modules/admin/", "src/shell/console-home.ts", "src/shell/admin-asks*.ts(x)", "src/shell/weekly-email*.ts"]
---
# The admin console (Founderhall transplant, area 6)

What it does now: the console's everyday screens use Founderhall's screens on Community's engine.
- `/admin` Home: the live dashboard (asked / made / declined headline, Every intro counted, Members, Latest in the
  intro log, Members who connected their network, Lookups this month, Asks & updates, Mail) and, before launch, the
  four-step launch checklist.
- `/admin/report` the printable partner report (period switch, Send to partners, CSV, PDF); `/admin/report/send`
  sends it with the email preview.
- `/admin/intros` the Intro log: period switch, CSV, state chips, the log, the asks-a-week and outcome-question forms.
- `/admin/members` (filters, search, one table) and `/admin/invites` (many people at once, profile fill-in consent,
  waiting to sign in, the invite email preview).
- `/admin/asks` Asks & digest (figures, digest settings, every ask and update with Pin / Close / Remove);
  `/admin/digest` the digest as it goes out, for any member, and a test send. `/admin/weekly-email` redirects there.
- `/admin/jobs` the Job board settings, public link and embed lines.
- Admins see who asked whom (the owner's decision, 2026-11-11); notes and reasons stay private.
- Emails: the invite, the partner report and the digest, word for word as Founderhall's (the digest ends with
  "Stop the weekly digest").

Kept from Community on purpose (Community-only functions): Revoke on invites, "Free up a LinkedIn profile" on
Members, "A made-up member" in the digest picker, "Pull now" on linked job boards, the Set up count bubble (reports
and approvals waiting). Pin shows only on open asks: Community's engine pins open asks only.

Open, for the orchestrator or the owner: the one line "the fund's admins can see who asked whom" on the intro-ask page
(the search-and-ask area's file); the "Credit me in reports" switch on the member card no longer changes the report
(the profile area's file); a fresh install's public job board starts off (Founderhall's starts on) and the default
fund colour comes from the foundation. Side by side: `reports/pairs/` and `reports/pairs.md`.
