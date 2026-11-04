# Community

A self-hostable community portal for VC networks, built on Village. This repo is a bare skeleton that exists to prove the app deploys. Feed, DMs, intros and the Village integration come later.

## Deploy

> **Status:** No button below has been tried on a live platform. The repo is private, and the Vercel and DigitalOcean buttons need a public repo. The Railway template does not exist yet.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/REPLACE_WITH_TEMPLATE_CODE)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVillageHQ%2Fcommunity&project-name=community&repository-name=community&env=SETUP_TOKEN&envDescription=Choose%20a%20long%20random%20password%20of%20at%20least%2032%20characters.%20You%20will%20enter%20it%20once%20at%20%2Fsetup%20to%20create%20your%20admin%20account.&envLink=https%3A%2F%2Fgithub.com%2FVillageHQ%2Fcommunity%23setup-token&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/VillageHQ/community/tree/main)

1. Click a button and follow the platform's steps.
2. Set your setup token when asked. On Railway it's created for you: copy `SETUP_TOKEN` from the service's variables.
3. Wait for the deploy to finish.
4. Open `/setup` on your new site. Enter the token and your name, email and password.
5. Sign in. Setup closes for good after this.

### Setup token

The setup token is a long password that proves you own the deployment. It needs at least 32 random characters. A password manager's generator works, or run `openssl rand -hex 32`. If it's missing or too weak, `/setup` explains how to fix it and creates nothing.

### Before real use

DigitalOcean's dev database has 512 MiB and no backups. Upgrade to a managed database for real use.

### Getting updates

- **Railway:** Railway notifies you when the template's repo changes, and you choose when to apply it.
- **Vercel:** The button copies this repo to your account. Pull changes from this repo into your copy, and each push redeploys.
- **DigitalOcean:** The app follows this repo's `main` but doesn't update by itself. Start a new deploy from the dashboard.

## Technical details

Next.js App Router, TypeScript, Tailwind, shadcn/ui, Better Auth (email and password, Drizzle adapter), Drizzle with `pg` over TCP, pnpm, Vitest.

**Health:** `GET /api/health` returns `{"status":"ok"}` with 200, or `{"status":"unavailable"}` with 503 when the database is unreachable, slow, or unmigrated.

**Migrations:** The app migrates itself at boot, from `src/instrumentation.ts`, on every platform. It waits for one attempt. If that fails, it logs the cause, starts anyway, and retries in the background with a capped backoff. `/api/health` returns 503 until migrations land. A cheap check skips all of this once they're applied. A Postgres advisory lock serializes concurrent instances, and it needs a session, so set `DATABASE_URL_UNPOOLED` if `DATABASE_URL` goes through a transaction pooler. Vercel previews skip migrations unless `MIGRATE_ON_PREVIEW=true`, because a preview may share the production database. `node scripts/migrate.ts` runs the same migrations by hand from the repo root and exits non-zero with the cause.

**Sign-up:** Sign-up is closed until an admin exists and stays closed afterward. Invites are out of scope, so `/sign-up` shows a notice and `POST /api/auth/sign-up/email` refuses every request. `/setup` is the only way to create an account in this skeleton.

**Auth secret:** The app uses `BETTER_AUTH_SECRET` when set. Otherwise it generates a secret on first boot and stores it in the `instance_settings` table, so anyone with database read access can read it. Changing the secret later signs everyone out.

**Query timeouts:** Queries time out after 10 seconds on the client. Direct connections also set `statement_timeout`. The app omits it when `DATABASE_URL_UNPOOLED` is set or the hostname contains `-pooler`, because PgBouncer can reject it as a startup parameter. Any other transaction pooler that rejects it needs one of those signals.

**Lost admin:** The app refuses to demote, ban or remove the last admin through Better Auth's routes. Two admins demoting each other at the same instant can still race past this check. `/setup` never reopens. To recover, run this against your database:

```sql
UPDATE "user" SET role = 'admin', banned = false WHERE email = 'you@example.com';
```

**Rate limits:** Better Auth's limits and the `/api/setup` limit live in the `rate_limit` table, so they hold across instances. Normal requests prune expired rows in small batches. `POST /api/setup` answers 429 after 10 failed attempts in a minute, but it never blocks the correct token, so token length is what stops guessing. Each client is keyed by a header the platform overwrites, never by `X-Forwarded-For`:

| Platform | Header | What we know |
| --- | --- | --- |
| Vercel | `x-vercel-forwarded-for` | Confirmed: [docs](https://vercel.com/docs/headers/request-headers) say Vercel overwrites forwarded IP headers to prevent spoofing. |
| Railway | `x-real-ip` | Partly confirmed: [docs](https://docs.railway.com/networking/public-networking/specs-and-limits) name it as the client IP. Only a forum reply from staff says the edge overwrites client values. Other forum threads report CDN addresses in it, which would collapse clients into one bucket. |
| DigitalOcean | None by default | Not confirmed: [docs](https://docs.digitalocean.com/support/where-can-i-find-the-client-ip-address-of-a-request-connecting-to-my-app/) say App Platform adds `do-connecting-ip` but not that it replaces a client-sent value. |
| Anywhere else | None by default | Set `CLIENT_IP_HEADER` only if your proxy overwrites that header and clients can't reach the app directly. |

With no trusted header, all clients share one bucket per path. That can't be spoofed, but one abuser can throttle sign-in for everyone, at 3 attempts per 10 seconds. Once a live test shows DigitalOcean replaces a client-sent `do-connecting-ip`, set `CLIENT_IP_HEADER=do-connecting-ip`.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection for the app. |
| `SETUP_TOKEN` | For setup | Unlocks `/setup`. 32+ random characters. |
| `APP_URL` | Self-hosting | Public origin. Takes priority over platform variables. |
| `DATABASE_URL_UNPOOLED` | No | Direct connection, preferred for migrations. |
| `BETTER_AUTH_SECRET` | No | Overrides the generated auth secret. |
| `CLIENT_IP_HEADER` | No | Header your proxy overwrites with the client IP. Overrides the platform default. |
| `DATABASE_CA_CERT` | No | PEM CA used to verify database TLS. Escaped `\n` is accepted. |
| `DATABASE_TLS_ALLOW_UNVERIFIED` | No | `true` encrypts without verifying when no CA is available. No template sets it. |
| `MIGRATE_ON_PREVIEW` | No | `true` runs migrations on Vercel previews. |
| `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PROJECT_ID` | Set by Railway | Public origin and client IP header selection. |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | Set by Vercel | Public origin and client IP header selection. Previews trust only their own `VERCEL_URL`. |

### Railway template (for maintainers)

Build the template by hand. This repo has no Railway files, because Railway [deprecated Config as Code](https://docs.railway.com/infrastructure-as-code). Add a web service from this repo and a Postgres service, then set:

- `SETUP_TOKEN`: `${{secret(64)}}`
- `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
- Healthcheck path: `/api/health`
- Networking: generate a public domain

### Platform notes

**Vercel**

- The button clones a public repo. A private repo needs a manual import.
- The button provisions Neon only. We have not seen it work.
- Next.js documents `register` as running once per server instance, and Vercel documents `instrumentation.ts` for tracing, but neither says exactly when it runs on Vercel's functions. Check the first deploy's logs for `Migrations applied.`.
- A frozen function can't run background retries, so a failed migration retries on the next cold start.
- For long migrations, run `node scripts/migrate.ts` by hand first, because a function could freeze while holding the migration lock.
- Vercel picks pnpm from the lockfile. pnpm 10 switches itself to the `packageManager` version. pnpm 9 fails with `packages field missing or empty`, because `pnpm-workspace.yaml` holds settings only. If a build log shows pnpm 9, set `ENABLE_EXPERIMENTAL_COREPACK=1`.

**DigitalOcean**

- The button needs a public repo, and its docs list only one service plus a dev database.
- **No `/api/health` check, on purpose.** DigitalOcean [grants `public` rights during deployment](https://docs.digitalocean.com/support/how-do-i-fix-a-permission-denied-for-schema-public-error-in-my-dev-database/), and a failed deployment never gets them. A health check that requires migrations could block that grant, so the template uses the default TCP check. The first deploy may log `permission denied` and recover by itself. Whether dev databases allow migrations at all is unverified.
- **Database TLS fails closed.** The template binds `DATABASE_CA_CERT` to `${db.CA_CERT}`, which DigitalOcean documents only for managed databases. If it doesn't resolve on a dev database, the app refuses the self-signed certificate, keeps logging the cause, and `/api/health` stays at 503. No template disables verification. Setting `DATABASE_TLS_ALLOW_UNVERIFIED=true` yourself would connect without verifying the server, scoped to this app's database connections.

### Troubleshooting

**A page says "Something went wrong":** Open `/api/health`. A 503 means the app can't reach its database or migrations haven't landed yet. Check your host's logs for lines with `"scope":"migrations"` or `"scope":"health"`, which give the real cause. Migrations retry by themselves, so `permission denied` on a first DigitalOcean deploy can clear within a minute. `unable to verify the first certificate` means `DATABASE_CA_CERT` is missing or wrong. Otherwise, check that `DATABASE_URL` is set and the database is running.

### Other hosts

Any host works if it can run Node 24 and reach Postgres. Set `DATABASE_URL`, `APP_URL` and `SETUP_TOKEN`, then:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

### Local development

```sh
cp .env.example .env
docker compose up -d --wait
pnpm install
pnpm dev
```

Tests need a disposable database, and they wipe it:

```sh
docker compose exec postgres createdb -U community community_test
TEST_DATABASE_URL=postgres://community:community@localhost:5432/community_test pnpm test
```

`pnpm db:auth-schema` regenerates `src/database/auth-schema.ts` from the Better Auth config. `pnpm db:generate` writes a new SQL migration to `drizzle/`.

## License

MIT
