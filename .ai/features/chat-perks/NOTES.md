# Slack, Discord and perks: how it works today

- Two toggleable modules, both off by default: `chat` (Slack and Discord) and `perks`. Module notes:
  `src/modules/chat/AGENTS.md`, `src/modules/perks/AGENTS.md`.
- Posting is a shell job (`src/shell/chat-posts.ts`, every minute, right after the weekly email job in
  `shell/scheduled-jobs.ts`). It reads the newest 50 open asks of the last 2 days through `asks/reads-chat.ts`
  (active authors, no block either way), adds the weekly line once the weekly email job finished this week's run,
  and hands them to `chat/service-posts.ts`, which claims each (tool, item) in `chat_post` before sending.
- A channel gets only items from after its `posts_from_at`, set whenever a token is saved, a channel is picked or
  posting resumes, so none of those posts a backlog.
- `/api/chat/slack/command` is Slack's `/ask`, handled in `src/shell/slack-ask.ts`: signature within 5 minutes
  (bad ones rate limited per IP), the workspace id must match, then the Slack user's email must equal an active
  member's verified email; the ask goes through `createAsk` with the weekly allowance and the posting limit.
- Tokens and the signing secret are sealed with `SETUP_TOKEN` (`chat/service-secrets.ts`); a preview can't save them.
- Perks keeps only an https `builtfirst.com` iframe src. `/perks` and `/admin/perks` have their own CSP header in
  `next.config.mjs`. The Today card and the admin link use a full page load so that header applies; the menu entry
  uses the app's normal client navigation, so the frame there relies on the server-side address check.
- Tests: `src/modules/chat/chat.test.ts`, `src/modules/perks/perks.test.ts`, against `src/test/fake-chat-server.ts`.
