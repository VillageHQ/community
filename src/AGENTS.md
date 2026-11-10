# src

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: `docs/architecture.md`, `src/test/architecture/`, `src/modules/registry.ts`.

The app's code. The full map, the import rules and the file roles in a module are in `docs/architecture.md`;
read it before adding a file.

- `app/`: pages and route handlers. They parse, call one thing, and respond.
- `proxy.ts`: runs before every page; a page of a switched-off module answers 404 here, because the shared
  loading screen has already sent 200 by the time the page's own guard runs.
- `shell/`: code that reads several modules for one screen (navigation, Today, onboarding, the weekly email, the
  setup checklist, scheduled jobs).
- `modules/`: one folder per feature, each with its own `AGENTS.md`. Core: `members`, `admin`. Switches: `feed`,
  `messages`, `network`, `intros`, `asks`, `chat`, `job-board`, `perks`. `registry.ts` lists them.
- `platform/`: infrastructure with no product opinion (auth, audit, branding, database, email, jobs, rate limits,
  secrets, settings, Village, the weekly email schedule).
- `components/`: UI with no module knowledge; `components/ui/` is shadcn.
- `test/`: fake Village, Resend and chat servers, fixtures, and the architecture tests (`test/architecture/`), which
  fail on a wrong import, a route outside its module, a schema file `drizzle.config.ts` can't find, or a module
  page that doesn't 404 when switched off.

Rules:
- A module never imports a module it doesn't require; pass behaviour in from `shell/` or through a slot.
- New tables go in a module's `schema.ts`, then `pnpm db:generate`.
- Tests run on real Postgres (`TEST_DATABASE_URL`) against the fake servers; never real keys or email.
