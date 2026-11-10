---
id: fix-ops
status: building
waits-on: []
touches: ["vercel.json", ".do/", "src/platform/village/health.ts", "src/shell/village-trouble-notice.tsx", "src/modules/job-board/service.ts"]
checks: ["src/test/deploy-setups.test.ts", "src/modules/network/network.test.ts", "src/modules/job-board/job-board.test.ts"]
---
# Running-the-app fixes from the final check

What it does now.

- **Timed jobs on every host.** The weekly email, reminders, email retries, expiring intro asks and the nightly tasks run through the job runner on every supported setup without the owner adding anything:
  - Own server (`install.sh`, `deploy/vps/compose.yml`) and DigitalOcean (`.do/deploy.template.yaml`): `JOBS_SELF_TICK=true`, so the app calls its own tick endpoint every minute. DigitalOcean also sets `PORT=8080` to match its `http_port`.
  - Vercel: `vercel.json` has one Cron Job calling `/api/jobs/tick` daily at 09:00 UTC (the most Vercel's free plan allows). The button asks for `CRON_SECRET`, which Vercel sends with the call. Paid plans can switch it to every minute.
  - Railway (template built by hand): the README's template notes set `JOBS_SELF_TICK=true`.
- **When Village is down or refuses the keys.** Every Village call records whether Village answered. If it didn't answer (server error, timeout, unreachable, a reply that isn't JSON), or refused the community's keys (a 401 when minting a token), every admin page shows a notice with when it failed and when it last worked, and the admin badge lights up on Credits. A member's own expired token, out of credits, rate limits and "not found" don't count. Members see "Search is unavailable right now" on the Network page and in search, never "That didn't work"; the rest of the app works. The next call Village answers clears the notice.
- **Job board sources.** See the job board's spec: one source per careers link, and founders share only their own company's jobs.

Not here: emailing admins about Village, removing duplicate job sources that already exist, deploying anything.
