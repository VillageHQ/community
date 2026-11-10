# Running-the-app fixes from the final check (approved scope)

Approved by the owner as part of the Founderhall-to-Community build plan (after wave 3). This page restates the brief.

## Direction
Three things the final check found when running the app for real.

In:
1. **Timed jobs on every one-click host.** The deploy buttons and templates never switched on the job runner, so the
   weekly email, reminders and nightly tasks never ran there. Every supported setup now runs it by default, the
   way the own-server installer does, and the README says so. Only files in this repo change; nothing is deployed.
2. **Village down or refusing the key.** Admins see a plain notice in the admin area (and on Admin → Health) with
   when Village last worked. Members see a calm "search is unavailable right now" instead of an error, and the rest
   of the Network page keeps working.
3. **Job board sources.** One source per careers link across the community, so jobs never show twice. A founder
   links or adds jobs only for the company on their own card; an admin can still add any company.

Out: deploying anything, emailing admins about Village, removing duplicate sources that already exist.

## Deciding facts (assumed, listed for the maintainer)
- **Vercel**: Vercel's free plan only allows a cron job once a day; a more frequent schedule fails the deploy. The
  template ships a daily cron (`vercel.json`), and the button asks for `CRON_SECRET`, which Vercel sends with
  each cron call. Paid plans can change it to every minute. A daily tick still sends the weekly email (it sends
  for the current week on the first tick after the set time), at most a day late.
- **DigitalOcean**: one long-running server, so the template sets `JOBS_SELF_TICK=true` and `PORT=8080` (the port
  the self-tick calls).
- **Railway**: no files in the repo (Railway dropped config as code); the maintainer's template notes add
  `JOBS_SELF_TICK=true`.
- **Own server**: `deploy/vps/compose.yml` already sets `JOBS_SELF_TICK=true`; the root `docker-compose.yml` is only
  the local database for `pnpm dev`.
- "Their own company" is the company on the founder's member card. A founder with no company on their card is
  asked to add it first.
- Existing duplicate sources aren't deleted (a safety stop); new duplicates are refused in the app, not by a
  database index, so no migration is needed.

## Tests
- Job board: duplicate link refused (also under two quick clicks), founder limited to own company, admin may add any.
- Village health: a down Village and a refused key are recorded with the time, a later success clears the notice,
  the admin area shows the notice, and the member's failure view shows the calm message.
- Deploy files: a test reads each setup file and checks it starts the job runner.
- Lint, typecheck, architecture tests; a real local run of the own-server compose file where a job ticks.
