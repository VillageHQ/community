# Chat (Slack and Discord)

Posts new asks and a weekly line to a Slack or Discord channel, and answers Slack's `/ask`. Toggleable, off by default, no Village account.

- `manifest.ts`, `routes.ts`, `integration.ts`: identity, the admin tab, owned paths. No jobs here: the posting job is `src/shell/chat-posts.ts`, because it reads asks and intros.
- `contract.ts`: kinds, API paths, limits, Zod schemas, the connection view. Client-safe.
- `schema.ts`: `chat_connection` (one row per tool, sealed token and signing secret), `chat_post` (the ledger: one row per tool and item).
- `client.ts`: the only code that calls Slack's Web API and Discord's REST API. `SLACK_API_BASE` and `DISCORD_API_BASE` point it at `src/test/fake-chat-server.ts` in tests.
- `rules.ts`: post text and escaping, the Slack app manifest, Slack's request signature. Pure.
- `service-secrets.ts`: sealing with `SETUP_TOKEN`, like the Village secret. The only place a token is opened.
- `service.ts`: connect, channel, test post, pause, disconnect, and the single send.
- `service-posts.ts`: `postChatItems`, the ledger claim and send.
- `components/chat-forms.tsx`: the admin forms. The page is `src/app/(app)/admin/chat/page.tsx`.

Rules:

- An item posts once per tool: `chat_post`'s primary key is (kind, ref). A failed post is tried again at the next ticks, up to 5 attempts; a claim left "sending" for 10 minutes is taken again.
- A 429 is waited out (Retry-After, at most 30 seconds, 3 tries). A refused token (revoked, removed app, wrong token) sets `is_refused`: posting to that tool stops and the admin page says why, until a new token is saved.
- Items from before `posts_from_at` are never posted. Connecting and resuming set it, so neither floods the channel.
- Posts carry only an ask's title and the author's first name, or "a member" for someone the directory doesn't list. Asks by members in any block, either way, aren't posted (`asks/reads-chat.ts`).
- `/ask` (`src/shell/slack-ask.ts`): Slack's signature within 5 minutes, then the Slack user's email must equal an active member's verified email. The ask goes through `createAsk` with the weekly allowance and the posting limit. Bad signatures are rate limited per IP.
- Never log a token or a signing secret.
