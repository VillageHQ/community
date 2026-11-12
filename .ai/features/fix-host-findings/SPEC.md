---
id: fix-host-findings
status: in-review
waits-on: []
touches: ["src/proxy.ts", "src/platform/http/", "src/instrumentation.ts", "src/shell/ask-helpers.ts", "src/shell/message-policy.ts", "src/shell/account-deletion.ts", "src/modules/job-board/reads-hiring.ts", "src/modules/members/service-fill-in.ts", "src/modules/members/service-invites.ts", "src/modules/admin/reads-members.ts", "src/app/(app)/admin/invites/page.tsx", "README.md"]
---
# Fix build: findings from the Fly host test (`fix-host-findings`)

What these fixes do now. Charter: [CHARTER.md](CHARTER.md). How it works: [NOTES.md](NOTES.md).

- **HSTS:** every page sends `Strict-Transport-Security: max-age=31536000; includeSubDomains` when the app's address
  is https; never on http (local development).
- **One query at a time on a transaction:** the timed jobs (and the asks-left count, account deletion, the "were they
  introduced" check, the jobs on a profile or Today, the fill-in gate) never send two queries at once on one
  connection, so pg's deprecation warning is gone and pg 9 won't break them.
- **Fly.io:** the README has a "Deploy on Fly.io" section; on Fly without `CLIENT_IP_HEADER` the app logs one warning
  at start telling the admin to set `CLIENT_IP_HEADER=fly-client-ip`.
- **Revoked invites:** Admin › Invites lists them with a "Revoked" pill and "Sent …, revoked …", next to the expired
  ones, with Resend (no Revoke). Resend opens one again with a new link, unless the person has a newer invite or an
  account; a revoked invite followed by a newer one to the same person leaves the list.

## Depends on / check-ins
- None. Shared files touched lightly: `src/proxy.ts`, `src/instrumentation.ts`, `src/shell/ask-helpers.ts`,
  `README.md`.
