# Independent verification: fix-ops

Run on 2026-11-10 against a throwaway copy: `next dev` on port 55633 with its own database (`verify_app`, dropped
afterwards), a fake Village behind a switchable proxy on 55634 (normal / every call 401 / every call 500 / down =
socket destroyed / 402 out of credits / one stale member token), and a fake job feed server on 55635. Made-up
example.com people only: one admin, founders "Fran" (card company Acme Robotics), "Toby" (Beta Labs) and "Nora" (no
company).

Shortcuts taken (say so): member companies, onboarding and email confirmation were set directly in the database
(email is off, so confirming by hand would have been the UI route). The fake Village treats every member as linked
and synced, so Fran reached Network search through the real LinkedIn and consent steps without the sync window.

Changed tests also pass on a separate throwaway database: `deploy-setups`, `network-failure`, `network`, `job-board`
(4 files, 142 tests).

## 1. Every setup file starts the job runner: PASS

- `vercel.json`: `"crons": [{ "path": "/api/jobs/tick", "schedule": "0 9 * * *" }]` (daily, free-plan safe).
- Vercel buttons in `README.md` and `site/index.html`: `env=SETUP_TOKEN%2CCRON_SECRET`, with a description of both.
- `.do/deploy.template.yaml`: `PORT "8080"` (matches `http_port: 8080`; `next start` reads `PORT`, and self-tick
  calls `127.0.0.1:$PORT`) and `JOBS_SELF_TICK "true"`.
- `deploy/vps/compose.yml`: `JOBS_SELF_TICK: "true"` (unchanged from main).
- README Railway template notes: `` `JOBS_SELF_TICK`: `true` ``; settings table adds `CRON_SECRET`.
- Tick route against the running app with `CRON_SECRET` set: `GET` + `Authorization: Bearer <CRON_SECRET>` → **200**
  (all 8 jobs `ran`); `GET` with no header → **401**; wrong secret → **401**; `POST` + bearer → 200. The route exports
  GET for Vercel Cron.
- `vps-compose-tick.txt`: looks real. A `cm-fix-ops-app:local` image exists, built at 12:06 UTC, and the first job
  lease is at 12:08:18 UTC, about 80 s after boot as claimed. The minute-interval jobs (`chat-posts`, `email-outbox`)
  move forward 60 s later while `intro-expiry` doesn't, which matches the intervals. It's enough to show the
  own-server self-tick works. It leaves out the exact query and doesn't show that no outside scheduler ran.
- Weekly email on a daily tick: `readCurrentWeek` looks back up to 8 days, so a daily tick still sends that
  week's email (code read, not run).
- Caveat (code read): if an owner sets both `JOBS_TICK_SECRET` and `CRON_SECRET` to different values,
  `JOBS_TICK_SECRET` wins and Vercel's cron call gets 401. The README doesn't warn about this.

## 2. Village down / keys refused: PASS (two small notes)

- Down (socket destroyed): every admin page tried (`/admin`, `/admin/members`, `/admin/credits`, `/admin/jobs`,
  `/admin/report`, `/admin/health`, which redirects to the report) shows "Village isn't answering … didn't answer on
  Nov 10, 2026, 12:22 PM UTC. It last worked on … 12:19 PM UTC …". The Credits tab badge shows 1, and the account
  badge counts it. Screenshots: `admin-village-down-1280.jpg`, `admin-village-down-390.jpg`,
  `admin-village-down-credits-390.jpg`.
- 500 from Village: the same "isn't answering" notice.
- 401 on every call: "Village refused this community's keys … Check the Village keys" (links to
  `/admin/settings?step=keys`). Screenshot: `admin-keys-refused-1280.jpg`.
- Member: a search that fails in place shows "Search is unavailable right now" (CloudOff icon, Check again), with
  the search box and "Your network settings" still there: `member-search-unavailable-1280.jpg`, `-390.jpg`.
  Reloading `/network` while Village is down or refusing keys shows the same calm message for the whole page:
  `member-network-down-1280.jpg`, `-390.jpg`, `member-network-keys-refused-390.jpg`. "That didn't work" never
  showed. Today, Members, Messages and Asks all loaded normally while Village was down
  (`member-today-while-village-down-1280.jpg`).
- Recovery: after switching Village back to normal and loading `/network` once, the admin notice and the Credits
  badge both cleared.
- No false notice: 402 out of credits showed only the existing credits note and the Credits badge, with no
  "isn't answering". A member at their own daily limit ("That's today's lookups") raised no notice. A not-found
  path (404, "No warm way in yet") raised no notice.
- Note A, a brief false "keys refused": a stale member token (Village answers one 401, and the app re-mints and
  retries successfully) writes `village_trouble = keys_rejected` for a moment before the retry's success clears it.
  Repro: make the fake answer the next Bearer call with 401, then POST `/api/network/status` as a member 15 times
  while polling `instance_settings` every 5 ms. `keys_rejected` was seen once (12:31:48.744), and the final value
  was null every time. An admin loading a page in that window would see "Village refused this community's keys".
  Both writes are fire-and-forget from the SDK hook, so their order isn't guaranteed. A wrong order would leave the
  notice up until the next call, but that never happened in 21 tries (6 through the UI, 15 through the API). Also,
  one member whose own token keeps failing (after the single retry) raises the community-wide "keys refused"
  notice.
- Note B, health write failure: the hook path is safe (`void … .catch(logError)`). But `respondToVillageError`
  awaits `recordVillageOutcome` with no try/catch, so if that database write fails, the member gets a generic 500
  instead of the friendly Village message. This only happens on the error path, when the database is also failing.
  It was not run, only read.
- Dev only: Next's dev overlay shows "1 Issue" on the member page when the error boundary catches the status
  failure (console: "RequestFailure … handled by the error boundary"). It's not shown in production builds.
- Every successful Village call now costs two extra writes (DELETE of the trouble keys, plus a conditional
  upsert of last-OK at most once a minute). That isn't a bug, just extra load.

## 3. Job board: PASS (one cosmetic note)

- Duplicate link refused with 409 `job_link_taken`, "This careers link is already on the board, for Acme
  Robotics.", in every case tried:
  - the same founder through the form, using another Greenhouse host, upper case and a trailing slash
    (`job-boards.greenhouse.io/OK-ACME/` against `boards.greenhouse.io/ok-acme`);
  - a second founder through the API;
  - a query string and hash added to the link;
  - an admin.
  Screenshots: `founder-duplicate-refused-1280.jpg`, `founder-duplicate-refused-390.jpg` (Fran is refused a link
  the admin already added).
- Two requests at once: 3 rounds of 4 parallel POSTs (two founders, mixed case and slash) on a new link. Each round
  had exactly one 200, and the rest got `job_link_taken` or the 5-source limit. Afterwards the database had one row
  per lower(tool, slug).
- Another company: Toby (Beta Labs) posting `company: "Acme Robotics"` to `/sources/link`, or `"Gamma Corp"` to
  `/sources/manual`, gets **403** `job_company_not_yours`: "You can share jobs only for your own company, Beta Labs…".
  In the form, the Company field is read-only with "From your card. You share jobs for your own company."
  Screenshots: `founder-your-jobs-1280.jpg`, `founder-your-jobs-390.jpg`.
- No company on the card: the form is replaced by "Add your company to your card first…"
  (`founder-no-company-390.jpg`, `-1280.jpg`). The API answers **403** `job_company_missing` for both link and manual.
- Admin: the field is editable, and "Delta Dynamics" (link) and "Epsilon Ltd" (manual) are both accepted (200).
- Dodge attempts: a Cyrillic lookalike "Betа Labs" is refused. Spellings that reduce to the same slug are accepted:
  `"  beta   LABS "`, full-width "Ｂeta Labs", "Bêta Labs!", and a zero-width space. None of them is another company.
  But the server stores the typed name, not the card's, so the in-app board shows "beta LABS" with its inner spaces
  kept, next to "Beta Labs". You can only do this by calling the API directly (the form field is read-only). It's
  cosmetic, and a fix would be to store the card's company for founders.
- The board lists each source once. Repeated job titles in my run come from my fake serving the same fixture for
  every board, not from duplicate sources.

## What I broke
Nothing in tracked files. I added one throwaway database plus a second one for tests (both dropped), files under
`.ai/tmp/verify/`, and these report files. Every process I started was killed, and `cm-fix-ops-pg` was left
running.

## Repairs after this verification (round 1, by the builder)
- Note A (expired member token briefly read as "keys refused"): the request hook now ignores a 401 on a member's own call; only a refused token mint, made with the community's secret key, records "keys refused". New test: "doesn't tell the admin the keys were refused when only a member's token expired".
- Note B (a failed health write could turn the friendly error into a 500): the write in the error path is now caught and logged.
- Cosmetic (respelled company names): a founder's source is saved with the company name as their card spells it. The job-board test now links with "  stripe   EXAMPLE " and expects "Stripe Example".
- Caveat (JOBS_TICK_SECRET and CRON_SECRET both set on Vercel): the README's Vercel notes now say not to set JOBS_TICK_SECRET there.
- Re-check: lint, typecheck, and the architecture, network, admin, shell, Village, job-board and deploy-setup tests (45 files, 1276 tests) pass.
