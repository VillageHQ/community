# Members

Core. Always on. Other modules build on it, and it never imports them.

- `schema.ts`: profiles, tags, avatars, invites and `member_network`. That table also holds Village columns, because LinkedIn lives on it and splitting it needs a data migration.
- `service-profile.ts`, `reads-directory.ts`: the member card and the directory.
- `service-invites.ts`, `service-email-confirmation.ts`: issuing and accepting invites, and confirming an email.
- `service-admin.ts`: what an admin does to one member: confirm an email, confirm or clear a LinkedIn claim.
- `service-blocks.ts`, `contract-blocks.ts`: blocks. Whoever calls `setMemberBlocked` passes the effects that run in the same transaction.
- `slots.tsx`: `MemberConversationSlot`. Messages fills it, so members never imports messages.
- `service-linkedin.ts`: claiming a LinkedIn profile, and whether a member's email is trusted.
- `service-onboarding.ts`: onboarding state. `src/shell/onboarding.ts` decides the next step, because that needs network.
- `contract-*.ts`: Zod schemas and constants. The schema loads them outside Next, so they use relative imports and no `server-only`.
- `queries-*.ts`: client requests. `components/`: the UI.

Rules:

- Never store an invite token. Store its hash, and compare in constant time.
- Every admin change writes the audit log in the same transaction, through `withAdminTransaction`.
- Tests are next to the code. They run against real route handlers and a real database.
