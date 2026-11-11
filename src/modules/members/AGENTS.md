# Members

Core. Always on. Other modules build on it, and it never imports them.

- `schema.ts`: profiles, tags, avatars, invites and `member_network`. That table also holds Village columns, because LinkedIn lives on it and splitting it needs a data migration.
- `service-profile.ts`, `reads-directory.ts`: the member card and the directory. Stage, sector and cohort are free text, filtered as whole values ignoring case; the cohort starts from the invite. `readDirectory` takes an optional `HiringLookup` (the job board's count, passed in by `shell/directory-hiring.ts`).
- `service-invites.ts`, `service-email-confirmation.ts`: issuing and accepting invites, and confirming an email.
- `contract-bulk-invites.ts`, `service-bulk-invites.ts`: inviting many people from a pasted list or a CSV. Parsing drops leading formula characters; a CSV the admin downloads goes through `toCsv`.
- `service-admin.ts`: what an admin does to one member: confirm an email, confirm or clear a LinkedIn claim.
- `service-blocks.ts`, `contract-blocks.ts`: blocks. Whoever calls `setMemberBlocked` passes the effects that run in the same transaction.
- `service-report-credit.ts`: the member's "credit me in reports" switch. Off by default.
- `slots.tsx`: `MemberConversationSlot`. Messages fills it, so members never imports messages.
- `service-linkedin.ts`: claiming a LinkedIn profile, and whether a member's email is trusted.
- `service-fill-in.ts`, `contract-fill-in.ts`, `rules-fill-in.ts`: the profile fill-in's data. The admin's legal basis, each member's yes or no (`member_lookup`), and the filled-in lines (`member_fill_in`). Network makes the Village calls and saves through here.
- `service-onboarding.ts`: onboarding state. `src/shell/onboarding.ts` decides the next step, because that needs network.
- `contract-privacy.ts`, `service-privacy.ts`: `member_privacy`: hide me, who can message me, accept intro asks (null = never answered, treated as yes). `isListedMember` keeps hidden members out of every directory list.
- `service-erasure.ts`: the real delete's part here. The `user` row stays as a "Deleted member" placeholder with `deleted-<id>@reclaimed.invalid`; `member_removal.erased_at` marks it. `src/shell/account-deletion.ts` runs the whole delete.
- `contract-*.ts`: Zod schemas and constants. The schema loads them outside Next, so they use relative imports and no `server-only`.
- `queries-*.ts`: client requests. `components/`: the UI.

Rules:

- Never store an invite token. Store its hash, and compare in constant time.
- Every admin change writes the audit log in its transaction, through `withAdminTransaction`.
- Filled-in lines never go into `member_profile`. Own words win (`readShownCard`), an uploaded photo beats the filled face, a logo shows only beside the company found (`reads-pictures.ts`).
- The fill-in gate is `isLookupAllowed`: no basis, nobody; "Don't look me up" always wins, and deletes the lines (a hidden line keeps its hide, with no words). `saveFilledProfile` checks it again under the row lock.
- A refresh never touches `hidden_at`, so a hidden line stays hidden.
- Tests sit next to the code, against real route handlers and a real database.
