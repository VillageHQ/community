# Admin

Core. Always on. It sits on top of the features it manages, so it may import their public files, and nothing imports it except the shell and pages.

- `service-roster.ts`: roles, removal, unban, reclaim and reinvite. Every write takes the roster lock first.
- `service-reports.ts`, `service-report-resolution.ts`: saving reports and working the queue.
- `reads-*.ts`: the member list, audit log and community health.
- `schema.ts`: `content_report` and `member_removal`.
- `contract-modules.ts`, `queries-modules.ts`, `components/feature-screen.tsx`: the features screen. `src/shell/module-settings.ts` holds its logic, because it needs the registry.
- `queries-*.ts`: client requests. `components/`: the UI.

Rules:

- Every admin change writes the audit log in the same transaction, through `withAdminTransaction`.
- Removing a member always tries the Village departure, after the removal commits. Village being down must not stop a removal.
- Reports stay visible and resolvable whatever modules are on. Moderation can't disappear because a switch was flipped.
