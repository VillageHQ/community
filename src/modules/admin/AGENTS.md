# Admin

Core. Always on. It sits on top of the features it manages, so it may import their public files, and nothing imports it except the shell and pages.

- `service-roster.ts`: roles, removal, unban, reclaim and reinvite. Every write takes the roster lock first.
- `service-reports.ts`, `service-report-resolution.ts`: saving reports and working the queue.
- `reads-*.ts`: the member list, audit log and community health.
- Partner report: `reads-partner-report.ts` reads it once; `partner-report-rows.ts` turns that into the rows the page, the CSV and the email all render; `service-partner-report.ts` sends it to partners through the outbox and marks it shared.
- `schema.ts`: `content_report` and `member_removal`.
- `contract-modules.ts`, `queries-modules.ts`, `components/feature-screen.tsx`: the features screen. `src/shell/module-settings.ts` holds its logic, because it needs the registry.
- `queries-*.ts`: client requests. `components/`: the UI.

Rules:

- Every admin change writes the audit log in the same transaction, through `withAdminTransaction`.
- Removing a member always tries the Village departure, after the removal commits. Village being down must not stop a removal.
- Reports stay visible and resolvable whatever modules are on. Moderation can't disappear because a switch was flipped.
- The partner report shows counts and outcomes, never who asked whom. A connector is named only with "credit me in reports" on and while an active member. Every number comes from the one read, so the page, CSV and email can't disagree.
