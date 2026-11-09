# Members

Core. Always on. Other modules build on it, and it never imports them.

- `schema.ts`: profiles, tags, avatars, invites and `member_network`. That table also holds Village columns, because LinkedIn lives on it and splitting it needs a data migration.
- `service-profile.ts`, `reads-directory.ts`: the member card and the directory.
- `service-invites.ts`, `service-email-confirmation.ts`: issuing and accepting invites, and confirming an email.
- `contract-bulk-invites.ts`, `service-bulk-invites.ts`: inviting many people from a pasted list or a CSV. Parsing drops leading formula characters; a CSV the admin downloads goes through `toCsv`.
- `service-admin.ts`: what an admin does to one member: confirm an email, confirm or clear a LinkedIn claim.
- `service-blocks.ts`, `contract-blocks.ts`: blocks. Whoever calls `setMemberBlocked` passes the effects that run in the same transaction.
- `slots.tsx`: `MemberConversationSlot`. Messages fills it, so members never imports messages.
- `service-linkedin.ts`: claiming a LinkedIn profile, and whether a member's email is trusted.
- `service-fill-in.ts`, `contract-fill-in.ts`, `rules-fill-in.ts`: the profile fill-in's data. The admin's legal basis, each member's yes or no (`member_lookup`), and the filled-in lines (`member_fill_in`). Network makes the Village calls and saves through here.
- `service-onboarding.ts`: onboarding state. `src/shell/onboarding.ts` decides the next step, because that needs network.
- `contract-*.ts`: Zod schemas and constants. The schema loads them outside Next, so they use relative imports and no `server-only`.
- `queries-*.ts`: client requests. `components/`: the UI.

Rules:

- Never store an invite token. Store its hash, and compare in constant time.
- Every admin change writes the audit log in the same transaction, through `withAdminTransaction`.
- Filled-in lines never go into `member_profile`. The member's own words always win (`readShownCard`), and a filled-in face or logo shows only without an uploaded photo.
- The fill-in gate is `isLookupAllowed`: no basis, nobody; "Don't look me up" always wins, and deletes the lines. `saveFilledProfile` checks it again under the row lock.
- A refresh never touches `hidden_at`, so a hidden line stays hidden.
- Tests are next to the code. They run against real route handlers and a real database.
