# How the Fly host fixes work

- **HSTS.** `platform/http/strict-transport.ts`: `readStrictTransportValue(env)` answers the header's value when
  `resolveAppUrl` is https, else null (also when the address can't be worked out). `src/proxy.ts` wraps every answer
  (`proxy` → `routePage`) with `addStrictTransport`. The proxy's matcher skips `api/`, `_next/` and prefetches, so
  API answers don't carry it; a browser learns the rule from the first page it loads. Not in `next.config.mjs`:
  its headers are fixed at build time, and the Docker image is built before it knows APP_URL. Caddy (VPS) passes the
  header through.
- **Overlapping queries.** pg 8 queues a query sent while its connection is busy and warns once per process; pg 9
  will refuse it. A pool takes a new connection per query, so `Promise.all` over the pool is fine; over a transaction
  it is not. The warning on Fly came from `readAskAllowance` (`shell/ask-helpers.ts`), which the intro emails call
  through `provideWeeklyAllowance` inside the intro-expiry job's transaction. Tests never saw it because only
  `src/instrumentation.ts` registers that reader. Fixed there and in every other `Promise.all` over a connection
  that may be a transaction (`message-policy.ts`, `account-deletion.ts`, `job-board/reads-hiring.ts`,
  `members/service-fill-in.ts`). `src/test/query-overlap.ts` (`watchQueryOverlap`) records any such query;
  `src/shell/scheduled-jobs.test.ts` seeds the demo, registers the reader as boot does, runs every job and expects
  none.
- **Fly.** `warnWhenFlyLacksClientIpHeader` (`platform/http/client-ip.ts`), called at the end of `register()` in
  `src/instrumentation.ts`. The README's "Deploy on Fly.io" section and a row in the client IP table.
- **Revoked invites.** `readListedInvites` (`admin/reads-members.ts`, was `readOpenInvites`) adds never-used revoked
  invites unless another invite to the same email is open, used, or newer (`notExists` over an alias). `rotateInvite`
  (`members/service-invites.ts`) reads the row first; a revoked one goes through `requireRevokedInviteCanReopen` (no
  account, no open invite for that email), and the update clears `revoked_at`. Audit: `invite_resent`.
