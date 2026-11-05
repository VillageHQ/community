# Community

A self-hostable community portal for VC networks, built on Village. Members join by invite, fill in a card, post in a shared feed, find each other in a directory, message each other one to one, search their own Village network, including the relationships of everyone in the community, and ask a member for a warm intro.

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
6. Follow the checklist you land on: brand your community, register the domain, add your Village keys, create the group, and invite your first members. See [Connect Village](#connect-village) and [Invite members](#invite-members).

### Connect Village

You need a Village platform account and an active app. Billing is credits only, and your community spends your credits.

1. Open **Admin**. You land there after setup until the checklist is done. It shows the exact domain to enter in Village's Platform Settings.
2. Paste your public and secret keys there. The app checks them with Village before saving.
3. Open **Network**. Add your LinkedIn URL and sync your network in Village's popup.
4. Back in **Admin**, create the group. **Your own Village network becomes shared with every current and future member.**

Members then open **Network**, add their LinkedIn URL, agree to share, and sync. The app joins them to the group after that. A member can choose **Not now** and keep using the app, then opt in from **Network** later. Members can leave from the same page. Removing someone from this portal doesn't yet remove them from the Village group, so they should leave first. Village won't let the group's creator leave while other members remain.

### Invite members

Open **Admin**, then **Members**. Enter someone's email and you get a personal link to send them. It works once, for that email, and lasts 14 days. You can invite people before Village is connected.

The app stores only a hash of each link, so it can show a link only when it creates one. **New link** replaces the link and restarts the 14 days. The old link stops working. **Revoke** cancels a pending invite.

The person opens the link, chooses a name and password, and lands in a short first-run flow: their card, then an optional step to share their network. They can skip either one and pick it up later.

**Confirming who accepted:** Anyone holding a link can accept it, so holding one doesn't prove the person owns that inbox. Network search stays off until the email is confirmed. With email set up, the app sends a link to the invite's address, and the person can ask for another from **Network**. Opening the link changes nothing: they must be signed in to that same account and press **Confirm**, so a mail scanner following the link can't confirm anyone. Without it, **Admin**, **Members** shows them under **Waiting for approval**, with a badge, and one click confirms them. Everything else in the portal works while they wait.

**If someone else used the link:** The real owner sees "already used" and is told to contact you. Click **Wrong person?** on that invite. It bans the account, signs it out, frees its email and LinkedIn, and makes a new invite for the same address. If that account already joined the Village group, it stays in the group: this portal can't remove it from Village. Full member management comes later.

**A LinkedIn profile someone else holds:** Paste it under **Free up a LinkedIn profile** in **Members**, or use **Clear their LinkedIn** on their profile.

**Optional email:** To also send invites and intro notices by email, set `RESEND_API_KEY` and `RESEND_FROM_ADDRESS`, using a sender on a domain you verified in [Resend](https://resend.com). The deploy buttons don't ask for these. Without both, the copyable link is the whole invite flow and the Intros badge tells members about intros. If sending fails, the invite stays valid and the admin still gets the link.

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

**Design:** [`docs/design/tokens.md`](docs/design/tokens.md) defines the tokens and [`docs/design/mockup.html`](docs/design/mockup.html) shows the target. The mockup's people and numbers are fictional. Figtree comes from the `@fontsource-variable/figtree` npm package through `next/font/local`, so builds and pages need no font network. To add a page to the sidebar and tabs, add one line to `NAVIGATION` in `src/lib/navigation.ts`.

**Branding:** An admin sets the community's name, descriptor, logo and one accent color in **Admin**. The server derives every accent token per theme and writes them in the page's `<head>`, so there's no flash. Only a six-digit hex color reaches that style tag, checked on save and again on read. Logos live in Postgres so one-click deploys need no file storage. The limit is 512 KB, and only PNG, JPEG and WebP pass, verified by magic bytes. SVG is refused. A light mark on transparency gets a dark tile, chosen in the browser at upload. `GET /api/branding/logo` serves the logo publicly, because the sign-in page shows it, with the detected content type and `nosniff`.

**Health:** `GET /api/health` returns `{"status":"ok"}` with 200, or `{"status":"unavailable"}` with 503 when the database is unreachable, slow, or unmigrated.

**Migrations:** The app migrates itself at boot, from `src/instrumentation.ts`, on every platform. It waits for one attempt. If that fails, it logs the cause, starts anyway, and retries in the background with a capped backoff. `/api/health` returns 503 until migrations land. A cheap check skips all of this once they're applied. A Postgres advisory lock serializes concurrent instances, and it needs a session, so set `DATABASE_URL_UNPOOLED` if `DATABASE_URL` goes through a transaction pooler. Vercel previews skip migrations unless `MIGRATE_ON_PREVIEW=true`, because a preview may share the production database. `node scripts/migrate.ts` runs the same migrations by hand from the repo root and exits non-zero with the cause.

**Sign-up:** Public sign-up is closed. `/sign-up` shows a notice and `POST /api/auth/sign-up/email` refuses every request. `/setup` creates the first admin, and after that a valid invite is the only way to create an account.

**Invites:** Links are `/join/<token>`, with 256 random bits in the token and only its SHA-256 hash in the `invite` table. One transaction claims the invite and creates the account, so a token can't be used twice, even under concurrency. The account email is always the invite's email, and that's the email Village receives. Accounts start with `email_verified` false. Until the member confirms through the emailed link, or an admin confirms them, the app mints no Village token, records no consent, and refuses join, search and paths. Confirming takes a `POST` with an Origin check, from a signed-in session of the account the token was issued for. Tokens are single-use, last 7 days, and are stored only as hashes. The first admin from `/setup` starts verified, because they hold the deploy password. Migration `0005` marks accounts that predate invites as verified, so existing members keep working. Better Auth's `verify-email` route is refused, because it verifies on a `GET`, and its public `send-verification-email` route stays disabled. `POST /api/invites/accept` checks the Origin and the body size, and answers a used link and an email that already has an account the same way. Unknown links and failed accepts answer 429 after 10 in a minute, per client, but a valid link is never blocked, so one abuser can't lock out an invitee. Someone already signed in must sign out before accepting, so the Village browser session gets cleared.

**Members:** `/members` lists everyone except banned members. Only signed-in members can see it, and emails stay private to admins. Search uses the query builder with `LIKE` wildcards escaped. Profile websites accept only `http` and `https`, checked on save and again on read. LinkedIn is the same `member_network.linkedin_slug` that network search matches on, so its uniqueness rule applies, and a member can change a saved one but not clear it. An admin can clear a claim.

**Feed:** `/` is the signed-in landing page. Posts are plain text with an optional Ask, Win or Offer type, up to 3,000 characters, and replies go one level deep, up to 1,000. Both limits hold on the server and in the database. Text renders through React as text, never as HTML. Only `http` and `https` links up to 2,048 characters become anchors, with `rel="noopener noreferrer"`, and a link with credentials in it stays text. Bidirectional control characters are stripped on save and again on render, so a link's label can't lie about where it goes. Long posts and replies collapse behind **Show more**. Authors can edit and delete their own posts and replies, and an edit shows an "edited" marker. A member editing a pinned post unpins it, so an admin's pin can't vouch for words they didn't see. Reactions come from a fixed set of four. A primary key on post, member and reaction means a double click or a concurrent request can't double count, and the UI updates first and rolls back on failure. Pagination uses a keyset on `created_at` and `id`, at millisecond precision so the cursor survives JavaScript dates. A "new posts" check polls every 30 seconds, every 2 minutes after a failure, and only while the tab is visible. Unverified accounts can read and post, because network verification is separate. Banned members' posts, replies and reactions leave the feed for members and return if a temporary ban ends. Admins still see those posts and replies, marked banned, so they can delete them.

**Moderation:** Admins can pin up to 3 posts, counting pins on banned members' posts, and delete any post or reply. They can't edit someone else's words. Every delete by an admin writes rows to `moderation_record`, in the same transaction, with who deleted it, whose it was, its text and when. Deleting a post writes one more row for each reply it removes, linked by `parent_post_id`. The rows outlive the accounts. A member deleting their own content leaves no record: it's gone. There's no screen for these records yet.

**Messages:** `/messages` holds one-to-one conversations, text only, up to 4,000 characters on the server and in the database. Text gets the feed's treatment: bidirectional controls are stripped on save and on render, it renders as text, and only safe `http` and `https` links become anchors. A check and a unique constraint on a canonical pair of member IDs mean one conversation per pair, even under concurrent starts. A member starts one from a profile, a directory card, or **Say hi** in **New this week**. Sends carry a client-generated key, unique per conversation and sender, so a retry or a double click can't duplicate. Deleting your own message erases its text and leaves "Message deleted" for both of you. There is no editing. Older messages load by a keyset on a per-conversation sequence. The inbox loads 30 conversations at a time and searches by name on the server.

**Polling:** There are no WebSockets and no external provider. Each send or delete takes the conversation's row lock and bumps its revision, so commit order matches revision order, and a thread polls for rows past its cursor without missing any. An open thread polls every 4 seconds, 30 after a failure. The inbox and the navigation badge poll every 30 seconds, 2 minutes after a failure. Polling runs only while the tab is visible. There are no typing or online indicators. Messages send no email.

**Unread:** Each member has a read cursor per conversation. Opening a conversation with the tab visible moves it. New messages reach screen readers through a polite status region, separate from the list, so loading older ones announces nothing. There are no read receipts: the other member's cursor never reaches the browser, because it would reveal a block.

**Message privacy:** Only the two participants can read or send, on every route, page and cursor. Anyone else gets the same 404 as for an ID that doesn't exist. **Admins can't read DMs in this app**: no route, page or role reaches them. Better Auth's admin routes are an allowlist, so `impersonate-user`, `stop-impersonating`, `set-user-password`, `create-user`, `list-user-sessions` and `revoke-user-session` answer 404 for everyone, including server-side calls, and any route an upgrade adds stays closed until someone allows it. `update-user` changes only a name, a role or a ban, never a sign-in email. Password reset has no sender configured, so it issues no token. Moderation works through reports. **Report** on a message you received saves a copy of that message's text in `message_report`, with who sent it, who reported it and when, and nothing else from the conversation. The copy survives a later delete and both accounts. There's no screen for reports yet, so nobody reviews them until that ships. **Messages aren't end-to-end encrypted.** They sit in Postgres as plain text, so anyone with database access to your deployment can read them, including backups. The app says so, and you should tell your members who runs it.

**Blocking:** A member can block another from the thread or their profile. The blocked member isn't told: they can still open the conversation and send, and each message looks delivered to them but never reaches the blocker, their inbox or their unread count. Those messages stay hidden after an unblock. A blocker can't send until they unblock. A banned member's sessions die as usual, so they can't read or send. The other member keeps the thread in their inbox, read-only, can still report it, and can't send while the ban lasts.

**Network search:** `/network` ranks community members first. Search often takes a minute or more, so the wait shows real elapsed time and no progress bar, and the member can keep browsing: a notice appears when the results land. A search runs only when the member presses **Search**, never again on navigation, focus or reconnect, and results stay in the tab until it reloads. Paths load on click and cost one daily lookup when they aren't cached. Each person who can help shows who they are, a badge, and Village's own explanation of the relationship in plain words, with employee counts and ratings removed. Scores aren't shown. Remaining lookups appear only at 10 or fewer. Someone outside the community gets a label, no intro button, and a pointer to LinkedIn, because the portal can't reach them. A banned, unverified or departed member counts as outside. So does a member whose LinkedIn claim isn't backed up, because anyone can paste any profile: a member counts only when their name here matches the name on the Village profile (first and last, ignoring case, accents and middle names), or when an admin used **Confirm this LinkedIn** on their profile. A confirmation lapses if the LinkedIn changes. A matched member shows under their name here, with their profile. This takes no Village call. Someone who shares the real person's name can still claim the profile until an admin clears it. Paths cached before this version have no target name, so each is looked up once more on its next click.

**Intros:** A member asks a member for an intro from the paths panel, with a note of up to 1,000 characters. The states are `requested`, `accepted`, `declined`, `withdrawn`, `completed` and `expired`, and `INTRO_TRANSITIONS` in `src/lib/intros/intro-api.ts` lists the allowed moves. Every move is one conditional `UPDATE`, so a simultaneous accept and withdraw can't both land, and a partial unique index refuses a second open ask for the same requester, introducer and target, even under concurrency. Asks expire 14 days after they're made, and a yes restarts that clock so an unfinished one can't nag forever. An open ask also closes as expired when either member has left the group, and it can't be answered after that. Both happen at read time, because there are no scheduled jobs. The browser sends only the target's and connector's LinkedIn slugs and the note. The server reads everything else from that member's own unexpired cached path result, and snapshots name, headline, LinkedIn and reason. Village's paths response carries no headline for the target, so that field is usually empty. The requester must be verified and joined, and the connector must be a current, unbanned, verified, joined member on that cached result. A member can ask again after a decline, and the introducer can block them.

**Blocks and intros:** A member the introducer blocked gets the same answer as anyone else. The ask appears in their own list and later expires, but it reaches neither the introducer's list, badge nor inbox, it sends no email, and it stays hidden after an unblock, like messages. A block placed later works the same way. If the introducer blocks the requester, open asks leave the introducer's list and badge and can't be answered, while the requester's view doesn't change. If the requester blocks the introducer, an unanswered ask closes as withdrawn and an accepted one stops reaching the introducer. A member who blocked the connector themselves is told so, because that reveals nothing.

**The target hears nothing from this app:** The portal has no email for the person being introduced and contacts nobody. On a yes, the introducer copies a ready-made note that includes what the requester wrote, sends it themselves, then marks it as introduced. The ask dialog says the note may be passed on. Consent says "You say yes or no to every intro anyone asks you for", and that covers intros only. Being findable in search and appearing on someone's path isn't controlled per intro.

**Intro privacy:** Only the requester and the introducer can see an ask, on every route and page. The API answers anyone else, admins included, with the same 404 as for an ID that doesn't exist. The page shows them the same "isn't available" screen, with HTTP 200 because Next has already started streaming, and none of the ask. Admins see only counts by state, in **Admin**. A decline reason is optional and private to the introducer: the API never sends it to the requester, who sees a kind, neutral message. Notes and reasons sit in Postgres as plain text, like messages, so anyone with database access to your deployment can read them. Notes can't be reported yet: an introducer can decline and block.

**Intro email:** With Resend configured, the introducer gets an email on a new ask, and the requester on an accept or a decline. These carry names and a sign-in link, never the note, the relationship or a decline reason. A requester can trigger one new-ask email per introducer per 24 hours, so asking and withdrawing can't flood anyone. The badge still shows every ask. They send after the response, so a slow or failing send never breaks the action and timing can't reveal a block.

**Avatars:** Photos live in Postgres, like logos, so one-click deploys need no file storage. The browser crops each one to a 320 px JPEG, which also drops location metadata. The limit is 256 KB, and only PNG, JPEG and WebP pass, verified by magic bytes. SVG is refused. `GET /api/members/<id>/avatar` needs a signed-in member and serves the detected content type with `nosniff` and a sandboxing CSP. The app ignores Better Auth's `user.image`, because a member could point it at any URL.

**Auth secret:** The app uses `BETTER_AUTH_SECRET` when set. Otherwise it generates a secret on first boot and stores it in the `instance_settings` table, so anyone with database read access can read it. Changing the secret later signs everyone out.

**Village:** The server mints each member's token with `POST /v2/auth/tokens`, then calls the v2 API. The secret key and tokens never reach the browser, and the app never reads the SDK's `village.token` cookie. The browser only runs the App SDK for sync, and it's identified by an opaque UUID per member. Tokens need an email, so Village receives the member's email. Keys and the invite link live in `instance_settings` in plaintext, like the generated auth secret, so anyone with database read access can read them. Sign-out clears the SDK's `village.token` from this site only. Village's own session on its domain stays, so on a shared browser the next member's popup can reuse the first member's Village account. The email check below blocks that link until an admin approves it.

**Village link check:** Village doesn't sign the member reference in its widget, so anyone can send someone else a link that ties that person's Village account to their member ID. The app compares the email on `/v2/user/me` with the member's email, case-insensitively, before every join, search and path lookup. A match counts only when the member's email is verified, because a forwarded invite could otherwise own an account with someone else's email. On a mismatch it blocks them and tells the member to ask an admin. **Admin** lists the mismatch, and an admin can approve that exact pair of emails. A later change to either email blocks again. An admin can also reset a member's link there, which gives the member a new ID and clears their consent, group status and cached paths on this site. Reset removes nothing on Village's side: the old Village account stays linked to the old ID and stays in the group until it leaves inside Village, and Village won't link that same account to this site again yet.

**Credit limits:** Each member gets `DAILY_CREDIT_CALL_LIMIT` searches and uncached path lookups per UTC day, 50 by default, in `src/lib/village/daily-usage.ts`. Path results stay cached per member for 24 hours. Village error responses (400 and up) don't count, because Village doesn't debit them. Timeouts, network errors and any response that isn't a Village JSON error do count, including a proxy's HTML 502, because Village may have debited them.

**Query timeouts:** Queries time out after 10 seconds on the client. Direct connections also set `statement_timeout`. The app omits it when `DATABASE_URL_UNPOOLED` is set or the hostname contains `-pooler`, because PgBouncer can reject it as a startup parameter. Any other transaction pooler that rejects it needs one of those signals.

**Lost admin:** The app refuses to demote, ban or remove the last admin through Better Auth's routes. Two admins demoting each other at the same instant can still race past this check. `/setup` never reopens. To recover, run this against your database:

```sql
UPDATE "user" SET role = 'admin', banned = false WHERE email = 'you@example.com';
```

**Bans:** Every signed-in page and member route, plus the invite and email confirmation pages, checks the session's ban. A banned member's sessions are deleted on their next request, even if the ban was set directly in the database, and Better Auth refuses their next sign-in.

**Rate limits:** Better Auth's limits and the `/api/setup`, invite, feed and message limits live in the `rate_limit` table, so they hold across instances. Normal requests prune expired rows in small batches. Each member can publish 10 posts and 30 replies a minute, send 30 messages, open 30 conversations, file 20 reports and check for messages 300 times, which leaves room for more than 15 open tabs. They can make 10 intro asks, 30 intro changes and 300 intro reads a minute. A retried message that already landed doesn't count. `POST /api/setup` answers 429 after 10 failed attempts in a minute, but it never blocks the correct token, so token length is what stops guessing. Each client is keyed by a header the platform overwrites, never by `X-Forwarded-For`:

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
| `VILLAGE_API_URL` | No | Village API origin. Defaults to production. |
| `VILLAGE_SDK_URL` | No | Village App SDK URL. Defaults to production. |
| `BETTER_AUTH_SECRET` | No | Overrides the generated auth secret. |
| `RESEND_API_KEY` | No | Sends invites and intro notices by email through Resend. Needs `RESEND_FROM_ADDRESS` too. |
| `RESEND_FROM_ADDRESS` | No | The sender for those emails, like `Northwind <hello@example.com>`. |
| `RESEND_API_URL` | No | Resend API origin. Defaults to production. Tests point it at a fake server. |
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
