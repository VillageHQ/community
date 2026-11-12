# Community

A private home for a VC fund's founders, ready to deploy without writing code. They join by invite, post in a shared feed, find each other in a directory, message one to one and ask each other for warm intros. Through [Village](https://village.ai), they can also search everyone's networks together.

![The community feed, showing fictional founders asking for help and sharing wins](docs/screenshots/feed.png)

**You need:**

- An account on a host: [Vercel](https://vercel.com/signup) or [DigitalOcean](https://www.digitalocean.com). Hosting and database costs are theirs.
- A [Village developer account](https://village.ai/platform), which you can create during setup with Google. Only network search needs it. Your community spends your Village app's credits.

No terminal, no code. It's open source under the AGPL-3.0 licence, and you run your own copy.

## Deploy

> **Status:** No button below has been tried on a live platform yet. If a step doesn't match what you see, [tell us](https://github.com/VillageHQ/community/issues).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FVillageHQ%2Fcommunity&project-name=community&repository-name=community&env=SETUP_TOKEN%2CCRON_SECRET&envDescription=Choose%20two%20different%20long%20random%20passwords%20of%20at%20least%2032%20characters.%20SETUP_TOKEN%20you%20enter%20once%20at%20%2Fsetup%20to%20create%20your%20admin%20account.%20CRON_SECRET%20lets%20Vercel%20run%20the%20weekly%20email%20and%20other%20timed%20jobs.&envLink=https%3A%2F%2Fgithub.com%2FVillageHQ%2Fcommunity%23setup-token&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%2C%22protocol%22%3A%22storage%22%7D%5D)

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/VillageHQ/community/tree/main)

**Railway: coming soon.** We haven't published the one-click template yet, so there's no button to click. Use Vercel or DigitalOcean for now.

<!-- PLACEHOLDER for the Railway button. Once the template below exists, replace the line above with:
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template/YOUR_TEMPLATE_CODE?utm_medium=integration&utm_source=button&utm_campaign=community)
-->

1. Click a button and follow your host's steps. It creates the app and its database for you.
2. Choose your setup token when asked: a long password you enter once, in the next section. See [Setup token](#setup-token). On DigitalOcean, replace the `change-me` placeholder. Vercel also asks for `CRON_SECRET`: a second long random password (32+ characters) that Vercel sends when it runs the timed jobs. You never type it again.
3. Wait for the deploy to finish, then open your new site. Your host shows its address.

### On your own server

Rent a server, point a domain at it and paste one command. It leaves your community running on HTTPS, restarts it by itself and backs it up every day. We've run it on one rented server with a real certificate, and on fresh Ubuntu and Debian test machines.

```sh
curl -fsSL https://raw.githubusercontent.com/VillageHQ/community/main/install.sh | sudo bash
```

[Read the guide](docs/self-host-vps.md) for what to rent and how to point your domain.

### Deploy on Fly.io

There's no button, but the container image runs on Fly as it is. We tried it once on a throwaway app (2026-11-12): it built, migrated, signed in, ran its timed jobs and kept its data through a restart. You need the `fly` CLI and a Postgres database Fly's machines can reach.

1. `fly launch --no-deploy`, and point the build at the image's Dockerfile in `fly.toml`: `[build]` `dockerfile = "deploy/vps/Dockerfile"`. Set the health check to `/api/health` on port 3000, and turn auto-stop off so the timed jobs keep running.
2. Set these with `fly secrets set`:
   - `DATABASE_URL`: your Postgres connection.
   - `BETTER_AUTH_SECRET`: 32+ random characters. Optional (the app makes one if it's missing), but the test set it.
   - `APP_URL`: `https://<your-app>.fly.dev`, or your own domain.
   - `SETUP_TOKEN`: see [Setup token](#setup-token).
   - `JOBS_SELF_TICK=true`: the app runs its own timed jobs every minute.
   - `CLIENT_IP_HEADER=fly-client-ip`: Fly puts the visitor's address there. Without it, sign-in limits can't tell visitors apart, and the app says so in its log at start.
3. `fly deploy` on one machine with 1 GB of memory (shared-cpu-1x).


## Your first 10 minutes

1. **Create your admin account.** Your site opens on it. Enter the setup token and your name, email and password. Setup closes for good after this.
2. **Follow the checklist.** You land on it after you sign in. Your progress saves as you go.
   - **Brand your community:** your name, logo and color.
   - **Add your Village keys:** create your account on [Village's platform](https://village.ai/platform) with **New developer account**, and follow [Village's checklist](https://village.ai/platform/onboarding), which asks for a payment method before your app goes live. Copy both keys from [API Keys](https://village.ai/platform/settings/api-keys) and paste them in. We check them with Village before saving. In [App Settings](https://village.ai/platform/settings/app-settings), set **Title** to your community's name, because members see it when they sync.
   - **Create the group:** first open **Network**, add your LinkedIn and sync in Village's window. Then create the group. **Your own Village network becomes shared with every current and future member.**
   - **Invite your first members:** see below.
3. **Say hello.** Post a welcome in the feed, so the first founder doesn't walk into an empty room.

## How to invite people

Open **Admin**, then **Members**, then **Invite someone**. Enter their email and you get a personal link to send them. It works once, for that email, and lasts 14 days. You can invite people before Village is connected.

We store only a scrambled copy of each link, so you see it only when it's created. **New link** replaces it and restarts the 14 days. **Revoke** cancels a pending invite.

The person opens the link, chooses a name and password, and lands in a short first-run flow: their card, then an optional step to share their network.

**Confirming who accepted:** Anyone holding a link can accept it. So network search stays off until the email is confirmed. With email set up, they confirm it themselves from a link we send. Without it, they show up under **Waiting for approval** in **Members**, and you confirm them. Everything else works while they wait.

**If someone else used the link:** The real owner sees "already used" and is told to contact you. Open that person in **Members**, or the invite in the list, and click **Wrong person?**. It locks the account, signs it out, frees its email and LinkedIn, asks Village to take it out of the group if it joined, and makes a new invite for the same address.

**A LinkedIn profile someone else holds:** Paste it under **Free up a LinkedIn profile** in **Members**, or use **Clear their LinkedIn** under **Manage**.

**Email is optional:** To send invites and intro notices by email, [add two settings on your host](#changing-a-setting-on-your-host): `RESEND_API_KEY`, the key from your [Resend](https://resend.com) account, and `RESEND_FROM_ADDRESS`, a sender on a domain you verified there. The deploy buttons don't ask for these. **Admin**, **Settings** shows whether email is on and what that changes.

**How email is sent:** Each email is saved in the database together with the change that causes it, then sent right away. If Resend is down, it's tried again for about five hours, and nothing is sent twice. An email that still fails shows up in **Admin**, **Settings**. Intro and message emails carry a one-click unsubscribe, and members can turn them off on their card. To stop email to addresses that bounce or mark you as spam, add a Resend webhook for `email.bounced` and `email.complained` pointing at `/api/email/resend-webhook`, and set `RESEND_WEBHOOK_SECRET` to its signing secret.

**The weekly email:** Once a week, each member gets one email with what needs them: asks they could help with, intros waiting for their yes, and their own asks. A member with nothing to answer gets nothing. **Admin**, **Weekly email** sets the day, hour and time zone (Thursday 09:00 UTC by default), previews it with your own week or a made-up member, and sends you a test. It needs timed jobs (see `JOBS_SELF_TICK` and `JOBS_TICK_SECRET`). Each item has buttons that open a confirm page. To let members answer by replying with codes like `HELP 1` or `NO 2`, set `RESEND_REPLY_DOMAIN` to a domain Resend receives email on, and add `email.received` to the Resend webhook above. Members turn it off on their card or from the email.

**Timed jobs:** The weekly email, reminders, email retries, expiring old intro asks and the nightly tasks run through the job runner. Every supported setup switches it on by default: your own server with `install.sh` and the DigitalOcean button set `JOBS_SELF_TICK=true`, so the app ticks itself every minute; the Vercel button adds a Cron Job (`vercel.json`) that calls `/api/jobs/tick` once a day with your `CRON_SECRET`, because Vercel's free plan allows no more. Once a day still sends the weekly email, at most a day after its set time. On a paid Vercel plan, change the schedule in `vercel.json` to `* * * * *` for every minute. On any other host, have a scheduler call `POST /api/jobs/tick` every minute with `Authorization: Bearer <JOBS_TICK_SECRET>`, or set `JOBS_SELF_TICK=true` if the app runs as one long-lived server. Without either, emails still go out right away, but the weekly email, reminders and nightly tasks never run.

## Running your community

Everything lives in **Admin**.

- **Members:** Find anyone by name, email or LinkedIn. **Manage** holds every action for that person: make or remove an admin, confirm their email, **Wrong person?**, approve or reset their Village link, confirm or clear their LinkedIn, remove them, and unban them. Each one asks you to confirm first.
- **Reports:** Members can report posts, replies, asks, messages they received and intro notes they received. You see a copy of what was reported and who reported it. You can dismiss it, delete it if it's a post, reply or ask, or remove the member. Messages and intro notes can't be deleted from here. You never see the rest of a conversation or an ask.
- **Audit log:** Who did what, and when: role changes, removals, approvals, deletions, settings and more.
- **Partner report:** Real counts of members, sharing, active members and invites, and intro numbers per quarter (asked, each side's yes, introduced, declined, expired, open, what came of them), to print, download as a CSV or email to up to 20 partners. Counts, plus the top connectors by name (admins see who asked whom, the owner's decision); never an asker, the person asked for, or a note.
- **Credits:** This month's estimated credits against the community's monthly cap (7,500 unless you change it). Lookups stop at the cap, and every admin gets one email at 80% and one at 100%. Below that: searches and intro path lookups per day and per member, an estimated cost, and the daily limit per member. This site doesn't show your credit balance, so check it on [Village's platform](https://village.ai/platform/usage) and [buy more there](https://village.ai/platform/settings/billing). If you run out, members see a friendly note and you see a notice here.
- **Who members can ask for intros** (on **Credits**): how many members are connected and open to intro asks. **Remind members to connect** emails everyone who hasn't connected their network, at most once every 30 days each.
- **Profile fill-in** (on **Credits**): fills empty cards from public work profiles through Village, nightly. It stays off until you record what allows it: your membership terms, with their date, or "ask each member first". A member's own words always win, and each member can hide any filled-in line or say "Don't look me up" on their card. Their card also shows what Village receives.
- **Settings:** Come back to any step of the checklist, check email, and see your version.

**Removing someone:** They're signed out, can't sign back in, and leave the directory. You choose whether their posts and replies stay, which is the default, or go for good. If they're in the Village group, we also ask Village to take them out, using their own account on their behalf, and tell you what happened:

- **It worked:** Their network stops being shared from then on. Anyone who already saw results through them can't unsee those, and anything Village holds outside the group isn't touched.
- **They created the group:** Village refuses while other members remain, so their network stays shared until everyone else leaves.
- **Village failed or didn't answer:** They're still removed here, but their network stays shared through Village. Try again from their row in **Members**. Otherwise they have to leave inside Village.

**There's always an admin:** The app refuses to remove the last admin, even if two admins try to remove each other at the same moment. Admins can't change their own role or remove themselves.

## If someone forgets their password

**With email on:** Anyone can use **Forgot your password?** on the sign-in page. The link works once and lasts one hour, and using it signs them out everywhere.

**With email off, for an admin:** Use **I lost my admin password**, on that same page, with your setup token. It works for active admins only, signs you out everywhere and goes in the audit log. Lost the token too? [Set a new `SETUP_TOKEN` on your host](#changing-a-setting-on-your-host), then paste your Village keys again, because the old token sealed them.

**With email off, for a member:** Turn email on, or remove them and use **Invite them back as a new account**. That's a new account: their old private messages stay on the old one, and they don't get them back. There's no way for an admin to set or reset a member's password, on purpose. It would let that admin sign in as them and read their private messages.

## How to get help

- **Something's wrong on your site:** Start with [Troubleshooting](#troubleshooting) below.
- **Someone can't sign in:** See [If someone forgets their password](#if-someone-forgets-their-password).
- **Village keys, credits or billing:** Use [Village's platform](https://village.ai/platform/usage).
- **A bug in this app, or a question:** [Open an issue](https://github.com/VillageHQ/community/issues) on GitHub. Don't paste keys or members' details there.
- **A security problem:** See [SECURITY.md](SECURITY.md). Don't open a public issue.

## Setup token

The setup token is a long password that proves you own the deployment. You need it once, to create your admin account, and again if you lose your admin password while email is off, so keep it safe. It also seals your Village secret key in the database. If you change or remove it, the app can't read your Village keys until you put the old token back or paste the keys again. Nothing else is lost. Keys pasted with no token are stored unencrypted.

Use at least 32 random characters. A password manager's generator works, like [1Password's free one](https://1password.com/password-generator). If it's missing or too weak, your site explains how to fix it and creates nothing.

## Changing a setting on your host

Some settings live on your host, not in this app. Hosts call them environment variables. To add or change one:

- **Vercel:** Open your project, then **Settings**, **Environment Variables**. Save it, then open **Deployments** and choose **Redeploy** on the latest one.
- **Railway:** Open your service, then **Variables**. Save it, then click **Deploy**.
- **DigitalOcean:** Open your app, then **Settings**, **App-Level Environment Variables**. Saving restarts the app.

## Before real use

DigitalOcean's dev database has 512 MiB and no backups. Upgrade to a managed database for real use.

## Getting updates

You can see your version in **Admin**, **Settings**. Updates aren't automatic.

- **Railway:** Railway notifies you when the template's repo changes, and you choose when to apply it.
- **Vercel:** The button copies this repo to your account. Pull changes from this repo into your copy, and each push redeploys.
- **DigitalOcean:** The app follows this repo's `main` but doesn't update by itself. Start a new deploy from the dashboard.
- **Your own server:** Run `sudo community upgrade`.

## Technical details

Next.js App Router, TypeScript, Tailwind, shadcn/ui, Better Auth (email and password, Drizzle adapter), Drizzle with `pg` over TCP, pnpm, Vitest.

**Design:** [`docs/design/tokens.md`](docs/design/tokens.md) defines the tokens. [`docs/design/mockup.html`](docs/design/mockup.html) is the early design mock: its people and numbers are fictional, and the app is the source of truth where they differ. Figtree comes from the `@fontsource-variable/figtree` npm package through `next/font/local`, so builds and pages need no font network. To add a page to the sidebar and tabs, add one line to `NAVIGATION` in `src/shell/navigation.ts`.

**Branding:** An admin sets the community's name, descriptor, logo and one accent color in **Admin**. The server derives every accent token per theme and writes them in the page's `<head>`, so there's no flash. Only a six-digit hex color reaches that style tag, checked on save and again on read. Logos live in Postgres so one-click deploys need no file storage. The limit is 512 KB, and only PNG, JPEG and WebP pass, verified by magic bytes. SVG is refused. A light mark on transparency gets a dark tile, chosen in the browser at upload. `GET /api/branding/logo` serves the logo publicly, because the sign-in page shows it, with the detected content type and `nosniff`.

**Health:** `GET /api/health` returns `{"status":"ok"}` with 200, or `{"status":"unavailable"}` with 503 when the database is unreachable, slow, or unmigrated.

**Migrations:** The app migrates itself at boot, from `src/instrumentation.ts`, on every platform. It waits for one attempt. If that fails, it logs the cause, starts anyway, and retries in the background with a capped backoff. `/api/health` returns 503 until migrations land. A cheap check skips all of this once they're applied. A Postgres advisory lock serializes concurrent instances, and it needs a session, so set `DATABASE_URL_UNPOOLED` if `DATABASE_URL` goes through a transaction pooler. Vercel previews skip migrations unless `MIGRATE_ON_PREVIEW=true`, because a preview may share the production database. `node scripts/migrate.ts` runs the same migrations by hand from the repo root and exits non-zero with the cause.

**Sign-up:** Public sign-up is closed. `/sign-up` shows a notice and `POST /api/auth/sign-up/email` refuses every request. `/setup` creates the first admin, and after that a valid invite is the only way to create an account.

**Invites:** Links are `/join/<token>`, with 256 random bits in the token and only its SHA-256 hash in the `invite` table. One transaction claims the invite and creates the account, so a token can't be used twice, even under concurrency. The account email is always the invite's email, and that's the email Village receives. Accounts start with `email_verified` false. Until the member confirms through the emailed link, or an admin confirms them, the app mints no Village token, records no consent, and refuses join, search and paths. Confirming takes a `POST` with an Origin check, from a signed-in session of the account the token was issued for. Tokens are single-use, last 7 days, and are stored only as hashes. The first admin from `/setup` starts verified, because they hold the deploy password. Migration `0005` marks accounts that predate invites as verified, so existing members keep working. Better Auth's `verify-email` route is refused, because it verifies on a `GET`, and its public `send-verification-email` route stays disabled. `POST /api/invites/accept` checks the Origin and the body size, and answers a used link and an email that already has an account the same way. Unknown links and failed accepts answer 429 after 10 in a minute, per client, but a valid link is never blocked, so one abuser can't lock out an invitee. Someone already signed in must sign out before accepting, so the Village browser session gets cleared.

**Members:** `/members` lists everyone except banned members. Only signed-in members can see it, and emails stay private to admins. **Admin**, **Members** lists everyone, including removed members. Search uses the query builder with `LIKE` wildcards escaped. Profile websites accept only `http` and `https`, checked on save and again on read. LinkedIn is the same `member_network.linkedin_slug` that network search matches on, so its uniqueness rule applies, and a member can change a saved one but not clear it. An admin can clear a claim.

**Feed:** `/` is the signed-in landing page. Posts are plain text with an optional Ask, Win or Offer type, up to 3,000 characters, and replies go one level deep, up to 1,000. Both limits hold on the server and in the database. Text renders through React as text, never as HTML. Only `http` and `https` links up to 2,048 characters become anchors, with `rel="noopener noreferrer"`, and a link with credentials in it stays text. Bidirectional control characters are stripped on save and again on render, so a link's label can't lie about where it goes. Long posts and replies collapse behind **Show more**. Authors can edit and delete their own posts and replies, and an edit shows an "edited" marker. A member editing a pinned post unpins it, so an admin's pin can't vouch for words they didn't see. Reactions come from a fixed set of four. A primary key on post, member and reaction means a double click or a concurrent request can't double count, and the UI updates first and rolls back on failure. Pagination uses a keyset on `created_at` and `id`, at millisecond precision so the cursor survives JavaScript dates. A "new posts" check polls every 30 seconds, every 2 minutes after a failure, and only while the tab is visible. Unverified accounts can read and post, because network verification is separate. Banned members' posts, replies and reactions leave the feed for members and return if a temporary ban ends. Admins still see those posts and replies, marked banned, so they can delete them. The exception is a member an admin removed with **Keep**: their posts and replies stay for everyone, read-only, marked "No longer a member", with no profile link and no new replies or reactions. Their own reactions stop counting.

**Moderation:** Admins can pin up to 3 posts, counting pins on banned members' posts, and delete any post or reply. They can't edit someone else's words. Every delete by an admin writes rows to `moderation_record`, in the same transaction, with who deleted it, whose it was, its text and when. Deleting a post writes one more row for each reply it removes, linked by `parent_post_id`. The rows outlive the accounts. A member deleting their own content leaves no record: it's gone.

**Reports:** A member can report someone else's post, reply or ask, and an introducer can report the note on an ask that reached them. Each saves a copy in `content_report`, one per reporter per target, with who wrote it, who reported it and when. Message reports stay in `message_report`. The copies survive later edits and deletes. **Admin**, **Reports** reads both tables and is the only place a reporter's name appears. Dismissing or deleting closes every open report on the same target. Removing a member closes every open report against them. Only posts, replies and asks can be deleted from the queue. A report on an ask stays in the queue, and can be resolved, while Asks is off.

**Audit log:** `admin_audit_entry` records role changes, removals, group departures, unbans, approvals, LinkedIn and Village link changes, invites, report decisions, pins, the daily limit, keys, the group, branding, the logo, the domain and password resets, with who and when. It holds no message or note text. Every admin action writes it in the same transaction as the change, after re-reading the acting admin's role with a shared row lock, so a removal can't overtake an action in flight or the other way round. A password reset by email writes it right after Better Auth saves the new password, because Better Auth can't join our transaction. **Admin**, **Audit log** shows it merged with `moderation_record`, newest first. There's no route that edits or deletes either table.

**Roles and removal:** `/api/admin/members/role`, `/remove` and `/unban`, and **Wrong person?**, run in one transaction that first takes a Postgres advisory lock, then re-reads the acting admin, then checks the target and the admin count, then writes. So two admins acting on each other can't both land, and the second gets a 403. Removing sets `banned`, drops the role to member, deletes the sessions and cached paths, and writes `member_removal` with the content choice. It doesn't delete the account, so **Unban** can bring them back as a member. Better Auth's `set-role`, `ban-user`, `unban-user`, `remove-user`, `revoke-user-sessions` and `update-user` answer 404, because they can't join that transaction and would skip the audit log. An account locked by **Wrong person?**, or replaced by **Invite them back as a new account**, has no email left, so it can't be unbanned.

**Leaving the group on removal:** After the removal commits, the app mints the member's own Village token and calls `POST /v2/groups/leave`, the same call a member's Leave button makes, and stores the outcome in `member_removal`. It checks first that the linked Village account has the member's email or an approved one, so it never acts for someone else's account. Village has no admin route for this, so it works only for accounts this site can still mint a token for. A failure never undoes the removal. **Reset Village link** leaves the old account in the group, so the app keeps its old ID in `stale_group_external_id`, still shows the member as in the group, and tries that ID too on removal. Leaving stops sharing from then on. It doesn't undo what anyone already saw.

**Messages:** `/messages` holds one-to-one conversations, text only, up to 4,000 characters on the server and in the database. Text gets the feed's treatment: bidirectional controls are stripped on save and on render, it renders as text, and only safe `http` and `https` links become anchors. A check and a unique constraint on a canonical pair of member IDs mean one conversation per pair, even under concurrent starts. A member starts one from a profile, a directory card, or **Say hi** in **New this week**. Sends carry a client-generated key, unique per conversation and sender, so a retry or a double click can't duplicate. Deleting your own message erases its text and leaves "Message deleted" for both of you. There is no editing. Older messages load by a keyset on a per-conversation sequence. The inbox loads 30 conversations at a time and searches by name on the server.

**Polling:** There are no WebSockets and no external provider. Each send or delete takes the conversation's row lock and bumps its revision, so commit order matches revision order, and a thread polls for rows past its cursor without missing any. An open thread polls every 4 seconds, 30 after a failure. The inbox and the navigation badge poll every 30 seconds, 2 minutes after a failure. Polling runs only while the tab is visible. There are no typing or online indicators. Messages send no email.

**Unread:** Each member has a read cursor per conversation. Opening a conversation with the tab visible moves it. New messages reach screen readers through a polite status region, separate from the list, so loading older ones announces nothing. There are no read receipts: the other member's cursor never reaches the browser, because it would reveal a block.

**Message privacy:** Only the two participants can read or send, on every route, page and cursor. Anyone else gets the same 404 as for an ID that doesn't exist. **Admins can't read DMs in this app**: no route, page or role reaches them, and the only message text they ever see is a reported copy. Better Auth's admin routes are an allowlist, so `impersonate-user`, `stop-impersonating`, `set-user-password`, `create-user`, `list-user-sessions` and `revoke-user-session` answer 404 for everyone, including server-side calls, and any route an upgrade adds stays closed until someone allows it. Moderation works through reports. **Report** on a message you received saves a copy of that message's text in `message_report`, with who sent it, who reported it and when, and nothing else from the conversation. The copy survives a later delete and both accounts. Admins review it in **Admin**, **Reports**, and can't delete the message itself. **Messages aren't end-to-end encrypted.** They sit in Postgres as plain text, so anyone with database access to your deployment can read them, including backups. The app says so, and you should tell your members who runs it.

**Blocking:** A member can block another from the thread or their profile. The blocked member isn't told: they can still open the conversation and send, and each message looks delivered to them but never reaches the blocker, their inbox or their unread count. Those messages stay hidden after an unblock. A blocker can't send until they unblock. A banned member's sessions die as usual, so they can't read or send. The other member keeps the thread in their inbox, read-only, can still report it, and can't send while the ban lasts.

**Search:** `/search` (old `/network` links redirect) asks "Who are you trying to reach?", with **In our network | Everywhere** (the admin's search scope is the default) and example searches. Members matching the words come first as **Member** rows. Then each person Village found shows the warmest path through a member who shares, with Village's warmth word ("Close", "Met"), and **Ask Marcus for an intro**, or "You already know Alex: reach out yourself" when the searcher knows them first-hand. The paths for a whole page of results come in one bulk call that is part of the search (Village charges 3 credits per 10 results; it doesn't count toward the member's daily lookups). The same search by the same member within 10 minutes is answered from the server's memory without a lookup. A search runs from the browser and can take a couple of minutes; the member can keep browsing, and a notice appears when it lands. With no path, the page offers **Ask the community** and **Search everywhere**. Without Village, search finds member profiles only. The intro ask is a page: one note from a search result (`/search/ask`), the three-part forwardable note from a profile (`/intros/new?via=…`), and the guided ask (`/ask`: what you need, who, the best way in, the note). Connecting, syncing and sharing your own network is on **My network** (`/me/network`). A member counts as a connector only when their name here matches the name on the Village profile (first and last, ignoring case, accents and middle names), or when an admin used **Confirm this LinkedIn** on their profile; anyone else is never offered as a way in.

**Intros:** A member asks a member for an intro from the paths panel, or from any member's profile with **Ask <name> for an intro**, with a note of up to 1,000 characters. From a profile, the asker names the person (name and company, optionally an email or a LinkedIn link), so it works without Village. The email is shown only to the connector, to send the yes-or-no link, and deleted when the ask closes. With Village on, the profile also says whether that member's network is shared and offers Search; it never lists their contacts. Intros are double opt-in. The states are `requested`, `asking_target`, `target_agreed`, `completed`, `declined`, `target_declined`, `withdrawn` and `expired`, plus `accepted` for asks a connector said yes to before double opt-in, and `INTRO_TRANSITIONS` in `src/modules/intros/contract.ts` lists the allowed moves. Every move is one conditional `UPDATE`, so a simultaneous accept and withdraw can't both land, and a partial unique index refuses a second open ask for the same requester, introducer and target, even under concurrency. Asks expire 14 days after they're made. A connector's yes leaves the target at least 7 days to answer, and the target's yes gives the connector 14 days to join them, so an unfinished one can't nag forever. An open ask from the paths panel also closes as expired when either member has left the group, and it can't be answered after that. Both happen at read time, because there are no scheduled jobs. The browser sends only the target's and connector's LinkedIn slugs and the note. The server reads everything else from that member's own unexpired cached path result, and snapshots name, headline, LinkedIn and reason. Village's paths response carries no headline for the target, so that field is usually empty. The requester must be verified and joined, and the connector must be a current, unbanned, verified, joined member on that cached result. A member can ask again after a decline, and the introducer can block them.

**Asks:** Off until an admin turns it on in **Admin**, **Features**. It needs no Village account. A member posts what they need, with a title of up to 120 characters, an optional detail and a kind: intro, hire, customer, advice or other. Each member can have 5 open asks and post 10 a minute. The board at `/asks` shows open asks, newest first, with who asked, when, and how many offered. **I can help** sends a note of up to 500 characters. The note is saved on the ask, and when Messages is on it also opens or continues a conversation with the asker. Only the asker and the helper read a note. The asker closes an ask with an outcome, and it leaves the board. An ask comes down 30 days after it was posted, worked out when someone reads the board, and the asker can renew it in its last 7 days or after. The Asks badge counts new offers on your open asks. A block hides each member's asks from the other and deletes the offers between them, so an unblock doesn't bring them back. Removing a member and deleting their content deletes their asks and offers too, with a copy in the audit log. Admins can remove any ask, from the board or the report queue.

**Blocks and intros:** A member the introducer blocked gets the same answer as anyone else. The ask appears in their own list and later expires, but it reaches neither the introducer's list, badge nor inbox, it sends no email, and it stays hidden after an unblock, like messages. A block placed later works the same way. If the introducer blocks the requester, open asks leave the introducer's list and badge and can't be answered, while the requester's view doesn't change. If the requester blocks the introducer, an unanswered ask closes as withdrawn and an accepted one stops reaching the introducer. A member who blocked the connector themselves is told so, because that reveals nothing.

**The target says yes first:** The person being introduced hears nothing until the connector says yes. Then the connector gets a private link, inside a ready-made note with what the requester wrote, and forwards it however they normally reach that person. The link opens a page at `/meet/<token>` that needs no account. It shows the requester's name, role and note, and the connector's name, and nothing else about anyone. It offers **Yes, introduce us**, **No thanks** and **Stop all intro requests**. On a yes, the connector copies one message that joins them both and marks it as introduced. With Resend configured, the connector can instead type the person's email, and the app sends them the link once. If they say yes, the app sends one email to them and the requester together and closes the ask as introduced. The portal never looks up an email through Village, and it deletes the address when the ask closes. The link is 32 random bytes, stored only as a hash, works once, closes when the ask does, and stops working the moment either member blocks the other, leaves, is banned or is removed. Opening it changes nothing, so link previews and mail scanners can't answer it: only a button press, sent as a POST from this site, does. Guessing is rate limited per client like invites, and the page sends `noindex` and `no-referrer`. **Stop all intro requests** saves a hash of that person's LinkedIn slug, closes every open ask for them, and withholds future ones the same way a block does. The audit log records that someone outside the community did this, without a name. Consent says "You say yes or no to every intro anyone asks you for", and that covers intros only. Being findable in search and appearing on someone's path isn't controlled per intro.

**Intro privacy:** Only the requester and the introducer can see an ask, on every route and page. The API answers anyone else, admins included, with the same 404 as for an ID that doesn't exist. The page shows them the same "isn't available" screen, with HTTP 200 because Next has already started streaming, and none of the ask. Admins see who asked whom, with its states and dates, in the console's **Intro log** and **Home**, and never a note or a reason, except the copy of a note an introducer reported. The **Partner report** shows totals and names the connectors, never the asker or the person asked for. A decline reason is optional and private to the introducer: the API never sends it to the requester, who sees a kind, neutral message. A requester can't tell a connector's no from the target's no, or see that the connector said yes: until the target answers, the ask looks the same as before. After a no, the requester sees who else can reach that person. After the target says no thanks, that requester's other asks for the same person are withheld. Notes and reasons sit in Postgres as plain text, like messages, so anyone with database access to your deployment can read them. An introducer can report a note, decline and block.

**Did it help:** About 7 days after an intro is made, the requester sees a card in Intros, and a badge, asking whether it helped: **Yes, it helped**, **Not yet** or **No**. Not yet asks again a week later. It stops asking 45 days after the intro. This happens at read time, with no scheduler and no email. Only the requester answers. The partner report counts how many said it helped, and the Intro log shows each answer.

**Intro email:** With Resend configured, the introducer gets an email on a new ask and when the target answers, and the requester when the target says yes or when the intro isn't happening, without saying who said no. These carry names and a sign-in link, never the note, the relationship or a decline reason. The target gets at most two emails, both only when the connector typed their address: the yes-or-no link, and the one message that joins them. A requester can trigger one new-ask email per introducer per 24 hours, so asking and withdrawing can't flood anyone. The badge still shows every ask. They send after the response, so a slow or failing send never breaks the action and timing can't reveal a block.

**Avatars:** Photos live in Postgres, like logos, so one-click deploys need no file storage. The browser crops each one to a 320 px JPEG, which also drops location metadata. The limit is 256 KB, and only PNG, JPEG and WebP pass, verified by magic bytes. SVG is refused. `GET /api/members/<id>/avatar` needs a signed-in member and serves the detected content type with `nosniff` and a sandboxing CSP. The app ignores Better Auth's `user.image`, because a member could point it at any URL.

**Auth secret:** The app uses `BETTER_AUTH_SECRET` when set. Otherwise it generates a secret on first boot and stores it in the `instance_settings` table, so anyone with database read access can read it. Changing the secret later signs everyone out.

**Village:** The app calls Village's v2 API through [`@villagehq/sdk`](https://www.npmjs.com/package/@villagehq/sdk). The server mints each member's token with `POST /v2/auth/tokens`, keeps it until Village rejects it, then mints once more. Each member is an opaque UUID to Village. Tokens need an email, so Village receives the member's email. The secret key never reaches the browser, but one kind of member token does. On the sync step, `POST /api/network/sync-token` mints a full token for the signed-in member, and the SDK hands it to Village's sync window, an iframe from `VILLAGE_APP_URL`, with `postMessage`. It never goes in a URL, and this site doesn't store it. The route checks the session, the Origin and the body size, and mints only at the sync step, so a member blocked for approval gets none. Until it expires, that token can do whatever the member's Village account can do through the API, so any script running on this site could use it. The sync window signs in with that token, not with whatever Village session the browser holds. The secret key is sealed in `instance_settings` with AES-256-GCM, using a key derived from `SETUP_TOKEN` with scrypt, so a database leak alone doesn't hand over your Village account. See [what that does and doesn't protect](docs/architecture.md#the-sealed-village-secret). Without a usable `SETUP_TOKEN` it stays in plaintext, and **Settings** warns you. Sealing doesn't erase an older plaintext copy: it stays in backups taken before the upgrade, and on the database's disk until Postgres recycles it. If that concerns you, rotate the key in Village and paste the new one. The public key and the invite link live in plaintext, like the generated auth secret, so anyone with database read access can read them. Sign-out clears the `village.token` the old Village script left on this site.

**Village link check:** The Village account a member links can use another email: a personal account, or someone else's on a shared browser. Before this version, Village's widget also took an unsigned member reference, so an older link may belong to someone else. The app compares the email on `GET /v2/user/status` with the member's email, case-insensitively, before every join, search and path lookup. A match counts only when the member's email is verified, because a forwarded invite could otherwise own an account with someone else's email. On a mismatch it blocks them and tells the member to ask an admin. **Admin**, **Members** shows them as *Blocked for approval*, and an admin can approve that exact pair of emails. A later change to either email blocks again. An admin can also reset a member's link there, which gives the member a new ID and clears their consent, group status and cached paths on this site. Reset removes nothing on Village's side: the old Village account stays linked to the old ID and stays in the group until it leaves inside Village, and Village won't link that same account to this site again yet.

**Credit limits:** Each member gets a daily number of searches and uncached path lookups per UTC day, 50 by default. An admin can set it from 1 to 500 in **Admin**, **Credits**, stored in `instance_settings`. Path results stay cached per member for 24 hours. Village error responses (400 and up) don't count, because Village doesn't debit them. Timeouts, network errors and any response that isn't a Village JSON error do count, including a proxy's HTML 502, because Village may have debited them.

**Credit estimates:** The app records lookups, not credits, and `member_daily_usage.search_count` says how many were searches. **Credits** counts about 11 credits for a search, which is a full page of results, and 5 for `POST /v2/people/paths`, at $0.02 a credit. Searches with fewer results cost less, and Village's prices can change, so it's labeled an estimate. Usage from before this count existed reads as path lookups. `GET /v2/app` returns no balance, so the app shows none and links to Village's platform. Village answers 402 with a flat `{"error":"insufficient_credits"}`, not its usual error object, and the SDK reads both. `src/test/village-recorded-responses.ts` records the response shapes Village really sends, and a test fails if the fake server in `src/test` drifts from them. Members get a plain note, the app stores the time in `instance_settings`, and **Admin** shows a badge and a notice until the next lookup succeeds.

**When Village is down:** If Village doesn't answer, or refuses this community's keys, every **Admin** page shows a notice with when it failed and when it last worked, and the admin badge lights up. Members see "Search is unavailable right now" in place of search, and everything else keeps working. The notice clears by itself after the next call Village answers. An out-of-credits answer has its own notice under **Credits**.

**Village status:** **Members** reads it from `member_network`, without calling Village. *Blocked for approval* means a mismatched Village email is waiting. *Ready* means they joined the group. *Syncing* means this site has seen their Village account but they haven't joined. *Sharing* means they agreed but this site hasn't seen their Village account. *Not shared* is everyone else. `village_linked_at` is set the next time the member's status loads, so accounts from before this version read as *Sharing* until then.

**Query timeouts:** Queries time out after 10 seconds on the client. Direct connections also set `statement_timeout`. The app omits it when `DATABASE_URL_UNPOOLED` is set or the hostname contains `-pooler`, because PgBouncer can reject it as a startup parameter. Any other transaction pooler that rejects it needs one of those signals.

**Password recovery:** With Resend set, `/forgot-password` calls Better Auth's `request-password-reset`, which answers the same for any email, and the email links to `/reset-password?token=`, where submitting a form spends the token. Better Auth's GET link stays closed, so a mail scanner can't use it. Requests are limited to 5 a minute per client and 3 emails a minute per account. Removed members get no email. Without Resend, `POST /api/recover-admin` needs the setup token, checked in constant time, with failures limited like `/api/setup`. It refuses weak tokens, other sites, anyone but an active admin, and every request once Resend is set. There are no admin-issued reset links, because they'd let an admin read a member's DMs.

**Bans:** Every signed-in page and member route, plus the invite and email confirmation pages, checks the session's ban. A banned member's sessions are deleted on their next request, even if the ban was set directly in the database, and Better Auth refuses their next sign-in.

**Rate limits:** Better Auth's limits and the `/api/setup`, invite, feed and message limits live in the `rate_limit` table, so they hold across instances. Normal requests prune expired rows in small batches. Each member can publish 10 posts and 30 replies a minute, send 30 messages, open 30 conversations, file 20 reports and check for messages 300 times, which leaves room for more than 15 open tabs. They can make 10 intro asks, 30 intro changes and 300 intro reads a minute. A retried message that already landed doesn't count. `POST /api/setup` answers 429 after 10 failed attempts in a minute, but it never blocks the correct token, so token length is what stops guessing. Each client is keyed by a header the platform overwrites, never by `X-Forwarded-For`:

| Platform | Header | What we know |
| --- | --- | --- |
| Vercel | `x-vercel-forwarded-for` | Confirmed: [docs](https://vercel.com/docs/headers/request-headers) say Vercel overwrites forwarded IP headers to prevent spoofing. |
| Railway | `x-real-ip` | Partly confirmed: [docs](https://docs.railway.com/networking/public-networking/specs-and-limits) name it as the client IP. Only a forum reply from staff says the edge overwrites client values. Other forum threads report CDN addresses in it, which would collapse clients into one bucket. |
| DigitalOcean | None by default | Not confirmed: [docs](https://docs.digitalocean.com/support/where-can-i-find-the-client-ip-address-of-a-request-connecting-to-my-app/) say App Platform adds `do-connecting-ip` but not that it replaces a client-sent value. |
| Your own server, with `install.sh` | `x-real-ip` | Tested: Caddy overwrites a client-sent value, and only Caddy can reach the app. |
| Fly.io | `fly-client-ip`, once you set `CLIENT_IP_HEADER=fly-client-ip` | Not on by default. [Fly's docs](https://fly.io/docs/networking/request-headers/) name it as the client's IP. The app warns at start when it runs on Fly without it. |
| Anywhere else | None by default | Set `CLIENT_IP_HEADER` only if your proxy overwrites that header and clients can't reach the app directly. |

With no trusted header, sign-in is limited per account instead: 5 wrong passwords in a minute pause that one account, and nobody else. Other paths, like password-reset requests, share one bucket per path, which can't be spoofed. Once a live test shows DigitalOcean replaces a client-sent `do-connecting-ip`, set `CLIENT_IP_HEADER=do-connecting-ip`.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection for the app. |
| `SETUP_TOKEN` | For setup | Unlocks `/setup`, and admin password recovery when email is off. Also seals your Village secret key, so keep it set. 32+ random characters. |
| `APP_URL` | Self-hosting | Public origin. Takes priority over platform variables. An `https://` address also makes pages send `Strict-Transport-Security` (a year, with subdomains). |
| `DATABASE_URL_UNPOOLED` | No | Direct connection, preferred for migrations. |
| `VILLAGE_API_URL` | No | Village API origin. Defaults to `https://api.village.ai`. |
| `VILLAGE_APP_URL` | No | Where Village's sync window loads from. Defaults to `https://village.ai`. |
| `BETTER_AUTH_SECRET` | No | Overrides the generated auth secret. |
| `RESEND_API_KEY` | No | Sends invites and intro notices by email through Resend. Needs `RESEND_FROM_ADDRESS` too. |
| `RESEND_FROM_ADDRESS` | No | The sender for those emails, like `Northwind <hello@example.com>`. |
| `RESEND_API_URL` | No | Resend API origin. Defaults to production. Tests point it at a fake server. |
| `CLIENT_IP_HEADER` | No | Header your proxy overwrites with the client IP. Overrides the platform default. |
| `RESEND_WEBHOOK_SECRET` | No | Signing secret of your Resend webhook. Bounced and complaining addresses stop getting optional email. |
| `JOBS_TICK_SECRET` | No | Lets a scheduler call `/api/jobs/tick`. 32+ random characters. `CRON_SECRET` works too. |
| `CRON_SECRET` | On Vercel | The Vercel button asks for it. Vercel sends it with each cron call. 32+ random characters. |
| `JOBS_SELF_TICK` | No | `true` makes a long-running server run its own timed jobs every minute. The `install.sh` server and the DigitalOcean template set it. |
| `DATABASE_CA_CERT` | No | PEM CA used to verify database TLS. Escaped `\n` is accepted. |
| `DATABASE_TLS_ALLOW_UNVERIFIED` | No | `true` encrypts without verifying when no CA is available. No template sets it. |
| `MIGRATE_ON_PREVIEW` | No | `true` runs migrations on Vercel previews. |
| `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PROJECT_ID` | Set by Railway | Public origin and client IP header selection. |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | Set by Vercel | Public origin and client IP header selection. Previews trust only their own `VERCEL_URL`. |
| `FLY_APP_NAME` | Set by Fly.io | Only to warn at start when `CLIENT_IP_HEADER` is missing. |

### Railway template (for maintainers)

It doesn't exist yet. Build the template by hand, then swap the placeholder in [Deploy](#deploy) for the button. This repo has no Railway files, because Railway [deprecated Config as Code](https://docs.railway.com/infrastructure-as-code). Add a web service from this repo and a Postgres service, then set:

- `SETUP_TOKEN`: `${{secret(64)}}`
- `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
- `JOBS_SELF_TICK`: `true` (the service runs as one long-lived server, so it ticks its own timed jobs)
- Healthcheck path: `/api/health`
- Networking: generate a public domain

### Platform notes

**Vercel**

- The button clones a public repo.
- **Timed jobs run once a day.** `vercel.json` has one Cron Job at 09:00 UTC, the most Vercel's free plan allows (a more frequent schedule fails the deploy there). Without `CRON_SECRET`, Vercel's call has no secret and the app refuses it, so the jobs never run: add it under **Settings**, **Environment Variables** and redeploy. Don't also set `JOBS_TICK_SECRET` there: the app checks that one first, so Vercel's call would be refused.
- The button provisions Neon only. We have not seen it work.
- Next.js documents `register` as running once per server instance, and Vercel documents `instrumentation.ts` for tracing, but neither says exactly when it runs on Vercel's functions. Check the first deploy's logs for `Migrations applied.`.
- A frozen function can't run background retries, so a failed migration retries on the next cold start.
- For long migrations, run `node scripts/migrate.ts` by hand first, because a function could freeze while holding the migration lock.
- Vercel picks pnpm from the lockfile. pnpm 10 switches itself to the `packageManager` version. pnpm 9 fails with `packages field missing or empty`, because `pnpm-workspace.yaml` holds settings only. If a build log shows pnpm 9, set `ENABLE_EXPERIMENTAL_COREPACK=1`.

**DigitalOcean**

- **Timed jobs run every minute.** The template sets `JOBS_SELF_TICK=true` and `PORT=8080`, the port the app listens on and the self-tick calls.
- The button needs a public repo, and supports one service plus a dev database. It prompts for `SETUP_TOKEN` because the template lists a `change-me` placeholder, which the app refuses as too weak.
- **No `/api/health` check, on purpose.** DigitalOcean [grants `public` rights during deployment](https://docs.digitalocean.com/support/how-do-i-fix-a-permission-denied-for-schema-public-error-in-my-dev-database/), and a failed deployment never gets them. A health check that requires migrations could block that grant, so the template uses the default TCP check. The first deploy may log `permission denied` and recover by itself. Whether dev databases allow migrations at all is unverified.
- **Database TLS fails closed.** The template binds `DATABASE_CA_CERT` to `${db.CA_CERT}`, which DigitalOcean documents only for managed databases. If it doesn't resolve on a dev database, the app refuses the self-signed certificate, keeps logging the cause, and `/api/health` stays at 503. No template disables verification. Setting `DATABASE_TLS_ALLOW_UNVERIFIED=true` yourself would connect without verifying the server, scoped to this app's database connections.

### Troubleshooting

**A page says "Something went wrong":** Wait a minute and reload, because a first deploy can take a moment to prepare its database. Still stuck? Add `/api/health` to your site's address. `{"status":"ok"}` means the database is fine. `{"status":"unavailable"}` means the app can't reach its database or hasn't finished preparing it. Check your host's logs for lines with `"scope":"migrations"` or `"scope":"health"`, which give the real cause. Migrations retry by themselves, so `permission denied` on a first DigitalOcean deploy can clear within a minute. `unable to verify the first certificate` means `DATABASE_CA_CERT` is missing or wrong. Otherwise, check that `DATABASE_URL` is set and the database is running.

**Every page fails, and the logs say `Cannot resolve the app URL`:** The app can't work out its own public address. On Railway, generate a public domain under your service's **Networking**. Anywhere else, [add a setting](#changing-a-setting-on-your-host) named `APP_URL` with your site's address, like `https://community.example.com`.

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

`pnpm db:auth-schema` regenerates `src/platform/database/auth-schema.ts` from the Better Auth config. `pnpm db:generate` writes a new SQL migration to `drizzle/`.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[AGPL-3.0](LICENSE). If you change the code and run it for others, the licence asks you to share your changes with them: set `NEXT_PUBLIC_SOURCE_CODE_URL` to your copy's source, and the "Source code" link in the app points there.
