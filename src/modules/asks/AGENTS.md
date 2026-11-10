# Asks

Members post what they need, or an update (a win), and others step in. Toggleable, on by default, and needs no Village account.

- `manifest.ts`: identity, nav entry and owned paths. `integration.ts`: the badge, and the block and removal hooks.
- `contract.ts`: limits, API paths, Zod schemas and shapes. Client-safe.
- `schema.ts`: `ask` (kind `ask` or `update`, optional target), `ask_offer`, `ask_helper`, `ask_answer`.
- `service.ts`: create, offer, answer, close, renew, mark seen, remove, the allowance setting. Admin calls `removeAskWithin` and `removeAnswerWithin` from the report queue.
- `service-helpers.ts`: routing a new ask to helpers and their one email.
- `reads.ts`: the board, your own asks, the badge count, the reportable copies, word matching and the allowance inputs.
- `limits.ts`: posting rate limits. `rules-*.ts`: pure state, time and URL rules.
- `queries.ts`: client requests. `components/`: the UI. `components/shared/`: the Today cards (asks you could help with, your asks).
- `rules-help-match.ts`: the one word-matching rule (a stop-word and everyday-word list, at least 3 letters, plural equals singular). Routing and the Today list both use it, so they can't disagree.
- `reads-could-help.ts`: the asks (not updates) a member was routed to, plus open asks whose words meet their "can help with" words or tags. The Today page and the weekly email read them.
- `schema-skip.ts`, `service-skip.ts`, `contract-today.ts`: `ask_skip`, a member's "not for me", which only hides an ask from their Today page and weekly email.

Rules:

- `expired` isn't stored. It's `listed_at` plus 30 days, worked out at read time. Renewing sets `listed_at`.
- The open limit counts unexpired, unclosed asks. Creating and renewing take the member row lock first.
- Helpers: members on the author's path to the named person (only members who joined the group) and members whose "can help with" or tags share a real word by `rules-help-match.ts` (at most 5). The saved reason names the shared words. Blocked members either way are never helpers. Each helper is emailed once (`notified_at` plus the outbox dedupe key), under the `asks` email topic. A failed lookup never stops the ask.
- The weekly allowance (default 5, admin 1 to 100) is shared with intro asks, so it lives in `src/shell/ask-helpers.ts`, passed in as `AllowanceCheck`. Updates don't count. Closing an ask doesn't give it back.
- This module can't import intros, network or messages. The shell passes the path finder, the allowance and the offer delivery. "I know someone" and "ask a helper for an intro" are in `src/shell/ask-helpers.ts`.
- Every read goes through `hasNoBlockBetween`, in both directions. A block also deletes offers between the two members.
- Offers are private. Answers are public under the ask and reportable.
- A removed member's asks, offers and answers leave every read through `isActiveMember`. Unbanning brings them back.
- Reports are saved and resolved by `admin/service-reports`, and stay resolvable with this module off.
- `service-erasure.ts`, `ask_tally`: a deleted account's asks become anonymous tally rows the partner report adds in.
