# Messages

Direct messages between two members. Toggleable.

- `schema.ts`: conversations, messages, read cursors and message reports.
- `service.ts`: send, delete, mark read, report, start a conversation.
- `reads.ts`: inbox, thread pages and changes, each scoped to who may see them.
- `limits.ts`: rate limits. Admin reports share the report limit.
- `email.ts`: the new-message email. At most one per conversation per recipient every 15 minutes (`message_email_notice`), queued in the send's transaction. It never carries the message text.
- Pages: `/inbox`, `/inbox/<id>`, `/messages/new?to=` (Message links there; the first Send starts it).
- `rules-thread-*.ts`: pure client cache and thread logic.
- `service-erasure.ts`: a deleted account's messages show as deleted; the other member keeps the conversation.
- `queries.ts`: client requests. `components/`: the UI.

Rules:

- Starting a conversation and sending take a `MessagePermission` (the recipient's "who can message me"). Routes pass `mayMessage` from `src/shell/message-policy.ts`, because "introduced" needs intros.

- `components/messages-slot-provider.tsx` fills the members slot, so the "Message" button appears wherever a member card does. Other modules must use `MemberConversationSlot`, and never import the button.
- Blocks belong to members.
- Admins can't read messages unless one is reported. Don't add a path that lets them.
