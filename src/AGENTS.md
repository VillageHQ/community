# src

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `docs/architecture.md`, `src/test/architecture/`, `src/modules/registry.ts`.

The app's code. Map, import rules and file roles: `docs/architecture.md`; read it before adding a file.

- `app/`: pages and route handlers. They parse, call one thing, respond.
- `proxy.ts`: answers 404 for a switched-off module's page, and 410 for a bad sign-in or invite link (`shell/gone-links.ts`).
  Every page it answers carries HSTS when the app runs on https (`platform/http/strict-transport.ts`).
  The app has no shared loading screen, so `notFound()` in a page answers a real 404.
- `shell/`: code reading several modules for one screen (navigation, Today, onboarding, weekly email, setup
  checklist, scheduled jobs).
- `modules/`: one folder per feature, each with its own `AGENTS.md`. Core: `members`, `admin`. Switches: `feed`,
  `messages`, `network`, `intros`, `asks`, `chat`, `job-board`, `perks`. `registry.ts` lists them.
- `platform/`: infrastructure with no product opinion (auth, audit, branding, database, email, jobs, rate limits,
  secrets, settings, Village, the weekly email schedule).
- `components/`: UI with no module knowledge; `components/ui/` holds the shared parts (`app/parts.css`).
- `test/`: fake Village, Resend and chat servers, fixtures, and the architecture tests (`test/architecture/`):
  they fail on a wrong import, a route outside its module, a schema `drizzle.config.ts` misses, or a module page
  not 404 when off.

Rules:
- A module never imports a module it doesn't require; pass behaviour in from `shell/` or through a slot.
- New tables go in a module's `schema.ts`, then `pnpm db:generate`.
- Tests run on real Postgres (`TEST_DATABASE_URL`) against fake servers; never real keys or email.
