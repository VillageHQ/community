# Charter: fix build, findings from the Fly host test (`fix-host-findings`)

Approved scope: the orchestrator's brief of 2026-11-12, from the Fly.io throwaway test of the container image
(`.workspace/scratch/founderhall-vs-community/fly-test-2026-11-12/report.md`) and one item left over from
`fix-accounts-privacy`. No other fix build runs in parallel. One pull request; the orchestrator merges it.

## Direction
1. **No HSTS header.** Send `Strict-Transport-Security` (a year, includeSubDomains) from the app itself when it runs on
   https (APP_URL starts with https), so every host gets it; never on plain http. The VPS Caddy passes the app's
   headers through, so the Caddyfile needs no change.
2. **Two queries at once on one connection.** The first timed-job run logged pg's "already executing a query"
   warning. Find the job, run its queries one after the other; a test shows no overlap.
3. **Fly needs `CLIENT_IP_HEADER=fly-client-ip`.** A short "Deploy on Fly.io" section in the deploy docs with the
   test's settings, and one warning in the log at start when `FLY_APP_NAME` is set but `CLIENT_IP_HEADER` isn't.
4. **Revoked invites don't show** on Admin › Invites: list them labelled "Revoked" with the date, next to the
   expired ones, with Resend.

Out: other security headers, a Fly button or `fly.toml`, making `fly-client-ip` a default without the setting.

## Deciding facts (assumed)
- HSTS goes on every page the app answers (through `src/proxy.ts`, read at run time). `next.config.mjs` headers are
  fixed at build time, before a container knows its APP_URL, so they can't carry it.
- Resend on a revoked invite opens it again with a new link (the old link stays dead), unless the person has a newer
  invite or an account since. A revoked invite the same person got a newer invite after leaves the list.

## Proof and tests
A failing test (or a recorded failing run) per item first, then the fix; typecheck, lint, the full suite on a
throwaway Postgres; a production build run with deprecation traces shows no warning; a separate agent checks the
running app (headers, the log, Admin › Invites at 390 and 1280 px).
