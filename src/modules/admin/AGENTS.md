# Admin

Core. Always on. It sits on top of the features it manages, so it may import their public files, and nothing imports it except the shell and pages.

- `service-roster.ts`: roles, removal, unban, reclaim and reinvite. Every write takes the roster lock first.
- `service-reports.ts`, `service-report-resolution.ts`: saving reports and working the queue.
- `reads-*.ts`: the member list, audit log and community health.
- Partner report (Founderhall's document): `reads-report-stats.ts` reads it once per period; `report-stats.ts` makes the page's numbers, the CSV and the email text; `service-partner-report.ts` sends it and marks it shared.
- Intro log: `reads-intro-log.ts`. Admins see who asked whom (the owner's decision), never the note or reason.
- `schema.ts`: `content_report` and `member_removal`.
- `components/email-setup-check.tsx`: Settings' email check; its DNS lookups (`src/platform/email/dns-check.ts`) take the resolver as an argument, so tests never touch real DNS.
- `contract-modules.ts`, `queries-modules.ts`, `components/feature-screen.tsx`: the features screen. `src/shell/module-settings.ts` holds its logic, because it needs the registry.
- `*-email.ts`: Admin › Email: sent emails (never a subject or body) and the do-not-send list.
- `queries-*.ts`: client requests. `components/`: the UI.

Rules:

- Every admin change writes the audit log in the same transaction, through `withAdminTransaction`.
- Removing a member always tries the Village departure, after the removal commits. Village being down must not stop a removal.
- Reports stay visible and resolvable whatever modules are on. Moderation can't disappear because a switch was flipped.
- The partner report names connectors, never the asker, the person asked for or a note. Every number comes from the one read, so the page, CSV and email can't disagree.
- Console home and the other console screens: `.ai/features/fh-console/NOTES.md`.
