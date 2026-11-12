---
id: fix-intros-reports
status: in-progress
waits-on: []
touches: ["src/modules/admin/", "src/platform/village/", "src/modules/network/reads-village-admin.ts", "src/modules/intros/", "src/modules/asks/", "src/shell/ask-helpers.ts", "src/shell/today.ts", "src/shell/today-list.tsx", "src/shell/console-home.ts", "src/components/ui/avatar.tsx", "src/app/(app)/me/data/page.tsx", "src/app/parts.css"]
---
# Fix build: intros, partner report and Village warnings (`fix-intros-reports`)

What these fixes do now. Charter: [CHARTER.md](CHARTER.md). How it works: [NOTES.md](NOTES.md).

- **Credit me in reports** (PRIV-07): a switch on Your data, off by default, shown while intros are on. What leaves
  the app (the partner email, the CSV, the printed page) names only active members who turned it on; the rest are
  "Other connectors". The admin's page in the app names every connector and marks who isn't credited.
- **No answer is not a decline** (ADM-04): asks that closed after 7 days with no answer are their own line on the
  partner report (page, title, email, CSV, breakdowns) and on console Home. Every row adds up.
- **Village trouble reaches the admin** (NET-09): out of credits, not answering, or refusing the keys sends one email
  to each active admin per spell of trouble, at most once a day per kind; console Home shows an urgent line.
- **Credits per day and per member** (NET-12): Admin › Village lists the last 30 UTC days and the members (fill-in on
  its own line), from the ledger of paid calls.
- **A member as the person asked for** (INTRO-06): once the connector says yes, a member whose verified email or
  confirmed LinkedIn matches the person sees the ask on Today and Your intros (and in the Intros badge) and answers
  Yes, introduce us / No thanks there. The connector's page says when the app emailed the person.
- **Ask any listed helper** (ASK-06): the author can ask a helper found by profile words, as a named intro for the
  person they name (prefilled from the ask).
- **Faces** (PROF-04): a filled-in face is a plain image in the page, over the initials; one that fails to load is
  hidden.

## Depends on / check-ins
- None. Shared files touched lightly: `src/app/parts.css`, `src/platform/email/kinds.ts`,
  `src/platform/settings/schema.ts`, `src/shell/today*.ts(x)`, `src/components/ui/avatar.tsx`.
