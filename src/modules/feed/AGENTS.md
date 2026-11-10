# Feed

Posts, replies, reactions and pins. Toggleable, off by default for a new community (migration 0021 kept it on for communities that already had members). `/` stays a home page, so it doesn't belong to this module.

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
