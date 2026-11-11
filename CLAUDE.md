# CLAUDE.md

The root map for agents in this repo. The root `AGENTS.md` is not tracked: `next dev` writes its own there, so the root `.gitignore` keeps it out, and this file holds the map instead.

## Project memory (`.ai/`)
- `.ai/roadmap.md` — the backlog; each item links its spec (lines without a spec link have none yet).
- `.ai/features/<slug>/SPEC.md` — one folder per feature (spec, charter, ledger, reports).
- `.ai/journeys/` — the main user journey + core journeys · `.ai/bugs.md` — bug log · `.ai/reports/` — repo-level reports.
- `.ai/tmp/`, `.ai/logs/` — scratch and run logs, never committed (see `.ai/.gitignore`).
- `.ai/vision.md` — why the product exists · `.ai/personas.md` — who it serves · `.ai/design/DESIGN.md` — where the design system lives · `.ai/changelog/` — one card per pull request.

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `package.json`, `CONTRIBUTING.md`, `docs/architecture.md`, `src/test/architecture/`.

## What this repo is
An open-source community app for a venture fund and its founders (AGPL-3.0): Today home, the weekly email, double
opt-in intros, the asks board, the partner report, and switchable modules. Next.js, TypeScript, Postgres + Drizzle,
Better Auth, Vitest, pnpm. Village is optional (network search and profile fill-in).

## How to run / test
- Run: `cp .env.example .env`, `docker compose up -d --wait`, `pnpm install`, `pnpm dev`; set `SETUP_TOKEN`, open `/setup`.
- Test: a database only the tests use in `TEST_DATABASE_URL` (the tests wipe it), then
  `pnpm lint && pnpm typecheck && pnpm test && pnpm build`. Fake Village, Resend and chat servers, no keys.
- Architecture tests only: `pnpm test src/test/architecture`.
- Migrations: `pnpm db:generate` after a schema change; the app migrates on boot (`pnpm db:migrate` by hand).

## Regressions worth guarding
- Module boundaries and 404-when-off (`src/test/architecture/`).
- Public repo hygiene: no real people, keys or community data (`src/test/public-repo.test.ts`).
- Admins see intro counts, never who asked whom; members never see each other's email addresses.
- Every email goes through the outbox in its change's transaction, and is sent once.

## Where the notes are
- `src/AGENTS.md` (the code map) and one per module: `src/modules/admin/`, `src/modules/asks/`, `src/modules/chat/`, `src/modules/feed/`, `src/modules/intros/`, `src/modules/job-board/`, `src/modules/members/`, `src/modules/messages/`, `src/modules/network/`, `src/modules/perks/`.
- `scripts/AGENTS.md`.
- How features work today: `.ai/features/chat-perks/NOTES.md`, `.ai/features/fix-intros/NOTES.md`,
  `.ai/features/fix-small/NOTES.md`, `.ai/features/hosting-data-settings/NOTES.md`, `.ai/features/partner-report/NOTES.md`, `.ai/features/small-gaps/NOTES.md`,
  `.ai/features/today-weekly/NOTES.md`, `.ai/features/two-sided-intros/NOTES.md`, `.ai/features/your-data/NOTES.md`,
  `.ai/features/admin-home/NOTES.md`, `.ai/features/admin-firstrun/NOTES.md`, `.ai/features/faces-logos/NOTES.md`, `.ai/features/demo-jobs-perks/NOTES.md`, `.ai/features/village-check/NOTES.md`.
- No notes: `.do/`, `.github/`, `deploy/`, `docs/` (public guides), `drizzle/` (generated), `site/` (has its README), `public/` (demo pictures),
  `vercel.json` (the Vercel Cron Job running the timed jobs daily). Every deploy setup runs the job runner;
  `src/test/deploy-setups.test.ts` guards it.
