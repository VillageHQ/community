# Messages

Direct messages between two members. Toggleable.

- `schema.ts`: conversations, messages, read cursors and message reports.
- `service.ts`: send, delete, mark read, report, start a conversation.
- `reads.ts`: inbox, thread pages and changes, each scoped to who may see them.
- `limits.ts`: rate limits. Admin reports share the report limit.
- `email.ts`: the new-message email. At most one per conversation per recipient every 15 minutes (`message_email_notice`), queued in the send's transaction. It never carries the message text.
- `rules-thread-*.ts`: pure client cache and thread logic.
- `queries.ts`: client requests. `components/`: the UI.

Rules:

- `components/messages-slot-provider.tsx` fills the members slot, so the "Message" button appears wherever a member card does. Other modules must use `MemberConversationSlot`, and never import the button.
- Blocks belong to members, not here. Intros and the profile page need them.
- Admins can't read messages unless one is reported. Don't add a path that lets them.
