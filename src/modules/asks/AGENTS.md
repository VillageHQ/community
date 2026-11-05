# Asks

Members post what they need, and others step in. Toggleable, off by default, and needs no Village account.

- `manifest.ts`: identity, nav entry and owned paths.
- `integration.ts`: the badge, and the block and removal hooks.
- `contract.ts`: limits, API paths, Zod schemas and shapes. Client-safe.
- `schema.ts`: `ask` and `ask_offer`.
- `service.ts`: create, offer, close, renew, mark seen, remove. Admin calls `removeAskWithin` from the report queue.
- `reads.ts`: the board, your own asks, the badge count and the reportable copy, with the visibility rules.
- `limits.ts`: posting rate limits.
- `rules-state.ts`: open, expired and renewal rules. `rules-time.ts`: age words. `rules-board-url.ts`: the board's URL. All pure.
- `queries.ts`: client requests. `components/`: the UI.

Rules:

- `expired` isn't stored. It's `listed_at` plus 30 days, worked out at read time. There's no scheduler, so never add a sweep. Renewing sets `listed_at`.
- The open limit counts unexpired, unclosed asks. Creating and renewing an expired ask both take the member row lock first, so two requests at once can't pass it.
- Every read goes through `hasNoBlockBetween`, in both directions. A block also deletes offers between the two members, so an unblock doesn't bring them back. That hook runs with the module off.
- Offers are private. Only the asker and the helper read a note. Everyone else, admins included, sees a count.
- A removed member's asks and offers leave every read through `isActiveMember`, even when an admin keeps their content, because nobody can reach them. Unbanning brings them back. Deleting their content also writes one audit entry per ask.
- This module can't import messages. `offerHelp` takes the delivery as an argument: the route passes `sendOfferAsMessage` from `src/shell/ask-offer-delivery.ts`, which checks the messages module. The note is saved first, so a failed delivery loses nothing. Buttons that open a conversation use `MemberConversationSlot`, which renders nothing when messages is off.
- Reports are saved and resolved by `admin/service-reports`, and stay resolvable with this module off. Admin removal writes `ask_removed` in the same transaction, with a copy of the text.
