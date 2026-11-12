# Feed

Posts, replies, reactions and pins. Toggleable, on where no admin chose (the owner's call, 2026-11-12; an admin's "off" is kept). Its page is `/feed`. `/` stays a home page, so it doesn't belong to this module.

- `schema.ts`: posts, comments, reactions and `moderation_record`, the copy kept when an admin or member deletes content.
- `service.ts`: create, edit, delete, pin, react. Admin calls `deleteMemberContent` and the `*Within` deletes from inside its own transactions.
- `reads.ts`: pages of posts and comments, with the visibility rules.
- `limits.ts`: posting rate limits.
- `rules-*.ts`: pure client cache, polling and time logic.
- `queries.ts`: client requests. `components/`: the UI.

Rules:

- Every read goes through `isAuthorVisibleTo`, so a banned member's content stays hidden.
- Deleting content writes `moderation_record` in the same transaction. The audit log reads it.
- Reports are saved by `admin/service-reports`, which the report route calls.
- `service-erasure.ts`: a deleted account's posts, replies and reactions, with no copy of their words; earlier moderation copies of their words lose the text.
