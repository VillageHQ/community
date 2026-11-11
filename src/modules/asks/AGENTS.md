# Asks

Members post a need or an update (a win); others step in. Toggleable, on by default, no Village needed.

- `manifest.ts`: identity, nav, owned paths, the Admin › Asks tab. `integration.ts`: the badge, block and removal hooks.
- `contract.ts`: limits, API paths, Zod schemas and shapes. Client-safe.
- `schema.ts`: `ask` (kind `ask` or `update`, optional target, admin pin), `ask_offer`, `ask_helper`, `ask_answer`.
- `service.ts`: create, offer, answer, close, renew, reopen, pin, remove, the allowance. Admin's report queue calls `removeAskWithin` and `removeAnswerWithin`.
- `service-helpers.ts`: routing a new ask to helpers and their one email.
- `reads.ts`: the board (tabs Open, Answered, Closed; search; pins), your own asks, the badge, reportable copies, the allowance inputs. `reads-admin.ts`: Admin › Asks counts and lists (the page is read by `src/shell/admin-asks.ts`).
- `limits.ts`: rate limits. `rules-*.ts`: pure state, time and URL rules. `queries.ts`: client requests. `components/`: the UI; `components/shared/`: the Today cards.
- `rules-help-match.ts`: the one word-matching rule. Routing and Today share it.
- `reads-could-help.ts`: asks a member was routed to, or whose words meet theirs. Today and the weekly email read them.
- `schema-skip.ts`, `service-skip.ts`, `contract-today.ts`: `ask_skip`, "not for me" on Today and the weekly email.

Rules:

- `expired` isn't stored: `listed_at` plus 30 days, at read time. Renewing and reopening set `listed_at`.
- The open limit counts unexpired, unclosed asks. Creating, renewing and reopening take the author's row lock first.
- Search matches every typed word in the title, details or an answer the viewer can see, in every state.
- At most 3 pins, only on open asks. Closing unpins; an expired pinned ask keeps its place. Pin, unpin and every reopen are audited.
- Helpers: path helpers and up to 5 word helpers, never blocked members, each emailed once (`notified_at` plus the outbox key).
- The weekly allowance (default 5, admin 1 to 100, set on Admin › Asks) is shared with intro asks, so it lives in `src/shell/ask-helpers.ts`. Updates don't count; closing doesn't give it back.
- This module can't import intros, network or messages; the shell passes those in.
- Every read goes through `hasNoBlockBetween`, both ways. A block deletes offers between the two.
- Offers are private. Answers are public and reportable. A removed member's content leaves every read (`isActiveMember`).
- `service-erasure.ts`, `ask_tally`: a deleted account's asks become anonymous rows the partner report and Admin › Asks add in.
