---
id: fh-setup-plumbing
status: in-progress
waits-on: [fh-foundation]
touches: ["src/app/(app)/admin/", "src/app/api/admin/", "src/modules/admin/", "src/modules/network/", "src/modules/chat/", "src/modules/perks/", "src/shell/admin-setup-rows.ts"]
---
# Set up and the plumbing pages (Founderhall transplant, area 7)

What it does now: the console's Set up area uses Founderhall's screens on Community's engine.
- `/admin/setup` lists the plumbing pages, each with one line and a state: Settings, Mail, Village, Import members,
  Sign-in links, Integrations, Perks, Audit log, plus Community's Features and Reports.
- `/admin/settings` Branding · Mail · Hosting & data · Plan; right column Mail checklist, Village, Audit log, and
  Community's "Version and updates".
- `/admin/mail` (was `/admin/email`): addresses, DNS checklist and "Check DNS now", DNS settings, test send, last 30
  days, do-not-send list, sending log.
- `/admin/village` (also replaces `/admin/credits`): connection and keys, limits and switches, profile fill-in, what
  Village sees, lookups, members connected and the nudge, costs, and the Village check.
- `/admin/import` (CSV import) and `/admin/links` (invite links waiting to be sent by hand).
- `/admin/integrations` (was `/admin/chat`), `/admin/perks` (with "Show Perks to members"), `/admin/audit`
  (was `/admin/audit-log`). Old addresses redirect permanently.
- Emails: the mail test and the Village nudge, word for word as Founderhall's.

Open, for the owner: emailed sign-in links are not shown on Sign-in links (a login token); Village's sync-screen
settings stay locked on (privacy). See `reports/side-by-side.md`.
