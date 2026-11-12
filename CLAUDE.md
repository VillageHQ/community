# CLAUDE.md

The root map for agents in this repo. The root `AGENTS.md` is not tracked: `next dev` writes its own there, so `.gitignore` keeps it out, and this file holds the map instead.

## Project memory (`.ai/`)
- `.ai/roadmap.md` — the backlog; each item links its spec (lines without a spec link have none yet).
- `.ai/features/<slug>/SPEC.md` — one folder per feature (spec, charter, ledger, reports).
- `.ai/journeys/` — the main user journey + core journeys · `.ai/bugs.md` — bug log · `.ai/reports/` — repo-level reports.
- `.ai/tmp/`, `.ai/logs/` — scratch and run logs, never committed.
- `.ai/vision.md` — why the product exists · `.ai/personas.md` — who it serves · `.ai/design/DESIGN.md` — where the design system lives · `.ai/changelog/` — one card per pull request.

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `package.json`, `CONTRIBUTING.md`, `docs/architecture.md`, `src/test/architecture/`.

## What this repo is
An open-source community app for a venture fund and its founders (AGPL-3.0): Today home, the weekly email, double
opt-in intros, the asks board, the partner report, and switchable modules. Next.js, TypeScript, Postgres + Drizzle,
Better Auth, Vitest, pnpm. Village is optional (network search, intro paths and profile fill-in; intros from profiles work without it).

## How to run / test
- Run: `cp .env.example .env`, `docker compose up -d --wait`, `pnpm install`, `pnpm dev`; set `SETUP_TOKEN`, open `/setup`.
- Test: a database only the tests use in `TEST_DATABASE_URL` (the tests wipe it), then
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Fake Village, Resend and chat servers, no keys.
- Architecture tests only: `pnpm test src/test/architecture`.
- Migrations: `pnpm db:generate` after a schema change; the app migrates on boot (`pnpm db:migrate` by hand).

## Regressions worth guarding
- Module boundaries and 404-when-off (`src/test/architecture/`).
- Public repo hygiene: no real people, keys or community data (`src/test/public-repo.test.ts`).
- Admins see who asked whom (the owner's decision, 2026-11-11), never an intro's note or reason; members never see each other's email addresses.
- Every email goes through the outbox in its change's transaction, and is sent once.

## Where the notes are
- `src/AGENTS.md` (the code map) and one per module: `src/modules/admin/`, `src/modules/asks/`, `src/modules/chat/`, `src/modules/feed/`, `src/modules/intros/`, `src/modules/job-board/`, `src/modules/members/`, `src/modules/messages/`, `src/modules/network/`, `src/modules/perks/`.
- `scripts/AGENTS.md`.
- How features work today: `.ai/features/chat-perks/NOTES.md`, `.ai/features/fix-intros/NOTES.md`,
  `.ai/features/fix-small/NOTES.md`, `.ai/features/hosting-data-settings/NOTES.md`, `.ai/features/partner-report/NOTES.md`, `.ai/features/small-gaps/NOTES.md`,
  `.ai/features/today-weekly/NOTES.md`, `.ai/features/two-sided-intros/NOTES.md`, `.ai/features/your-data/NOTES.md`,
  `.ai/features/admin-home/NOTES.md`, `.ai/features/admin-firstrun/NOTES.md`, `.ai/features/faces-logos/NOTES.md`, `.ai/features/demo-jobs-perks/NOTES.md`, `.ai/features/village-check/NOTES.md`,
  `.ai/features/reply-by-email/NOTES.md`,
  `.ai/features/jobs-on-cards/NOTES.md`,
  `.ai/features/asks-tools/NOTES.md`, `.ai/features/search-first/NOTES.md`, `.ai/features/intros-no-village/NOTES.md`, `.ai/features/demo-portraits/SPEC.md` (spec: how to add a portrait),
  `.ai/features/fh-foundation/NOTES.md` (look, parts, shell), `.ai/features/fh-dark/NOTES.md` (dark mode), `.ai/features/fh-public-signin/NOTES.md` (sign-in), `.ai/features/fh-setup-plumbing/NOTES.md` (Set up pages), `.ai/features/fh-inbox-jobs-perks/NOTES.md`, `.ai/features/fh-intros/NOTES.md` (intro screens, links, emails),
  `.ai/features/fh-today-asks/NOTES.md` (Today, Asks & updates),
  `.ai/features/fh-search-ask/NOTES.md` (search, asks),
  `.ai/features/fh-console/NOTES.md` (the admin console screens),
  `.ai/features/fh-directory-profile/NOTES.md` (Directory, profiles, My profile, Your data),
  `.ai/features/fh-final-pass/NOTES.md` (round 4: 404 and 410, the introduction email, Our jobs on My profile, print),
  `.ai/features/fh-followup/NOTES.md` (emailed invite link confirms, job board on by default, "copied" words),
  `.ai/features/fix-accounts-privacy/NOTES.md`, `.ai/features/fix-feed-digest-site/NOTES.md`,
  `.ai/features/fix-intros-reports/NOTES.md` (parity fixes), `.ai/features/fix-host-findings/NOTES.md` (HSTS, overlapping queries, Fly, revoked invites).
- No notes: `.do/`, `.github/`, `deploy/`, `docs/` (guides), `drizzle/` (generated), `site/` (own README), `public/` (demo pictures),
  `vercel.json` (the daily Vercel Cron Job). Every deploy setup runs the job runner;
  `src/test/deploy-setups.test.ts` guards it.
