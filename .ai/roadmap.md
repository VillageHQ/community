# Roadmap: the merged fund community app

> ⚠ RECONSTRUCTED from code on 2026-11-10 — needs confirmation
> Sources: the merge plan the owner approved, the Founderhall feature inventory (161 features), `git log`, open pull
> requests, `.ai/features/*/CHARTER.md`, and a check of each feature against the code on main (spot-checked by hand).

## How items are ranked
Current priorities (most important first):
1. Finish the merge: every Founderhall feature is done, or dropped on purpose (the parity map below).
2. Fix what the merge builds left behind (the known follow-ups).

Each open item gets these yes/no checks; code adds the points (change a number to change the rule):
- pain: A named user feels this pain today — +1
- severe: The pain blocks the main journey or costs real time or money — +2
- full-fix: The solution removes the pain fully, not partly — +1
- novel: It does something new that current tools can't — +1
- priority: It moves priority 1 / 2 / 3 — +3 / +2 / +1
- moving-part: It adds a new moving part, like a service or a database — −1
- pain-seen: The pain was seen in real use (a bug, a complaint, a log), not only guessed — confidence
- proven: The solution is proven (done before, here or elsewhere), not a guess — confidence
- confidence: all yes ×1 · one no ×0.75 · more ×0.5
- order: waiting on an unfinished item = hidden · each open item waiting on it = +1, at most +2 · touching the files of an open pull request = ranked after it

## Now (in flight)
- [ ] Running-the-app fixes from the final check: timed jobs on every host, a Village-down notice, one job source per careers link — fix-ops — open pull request — [spec](features/fix-ops/SPEC.md)
- [ ] Project notes: vision, personas, journeys, this roadmap and the parity map — project-notes — open pull request — [spec](features/project-notes/SPEC.md)
- [ ] The Your data page: export, real delete, privacy switches, the required "accept intro asks" question — your-data — open pull request, waits for the owner's yes (it deletes personal data) — [PR #20](https://github.com/VillageHQ/community/pull/20)
- [ ] The new look: serif headings, hairline edges, no "Network by Village" on member screens — look-theme — open pull request — [PR #26](https://github.com/VillageHQ/community/pull/26) · [spec](features/look-theme/SPEC.md)
- [x] Demo mode for sales: a made-up community, one-click demo sign-in, nightly reset — [demo-mode](features/demo-mode/SPEC.md) — merged, [PR #25](https://github.com/VillageHQ/community/pull/25)
- [ ] One marketing website, "Founderhall by Village", in `site/` — one-site — open pull request — [PR #23](https://github.com/VillageHQ/community/pull/23)
- [ ] Two preview bugs: helpers emailed but missing from Today, and matching on common words — preview-fixes — open pull request — [PR #22](https://github.com/VillageHQ/community/pull/22)

## Next (queued)
- [ ] Perks from the in-app menu skips the Perks page's security policy (client-side navigation) — (from chat-perks) — [spec](features/perks-menu-csp/SPEC.md)
- [ ] Slack /ask has no follow-up when posting takes more than 3 seconds — (from chat-perks) — [spec](features/slack-ask-slow-reply/SPEC.md)
- [ ] The sign-in password form clears the typed email — (from small-gaps) — [spec](features/sign-in-keeps-email/SPEC.md)
- [ ] The "no thanks" link later says "stopped intro requests" — (from two-sided-intros) — [spec](features/no-thanks-wording/SPEC.md)
- [ ] A switched-off module answers 200, not 404 — [spec](features/module-off-404/SPEC.md)
- [ ] A connector who said no still shows in the asker's paths list — [spec](features/declined-connector-paths/SPEC.md)
- [ ] Single invites have no cohort field — (from small-gaps) — [spec](features/invite-cohort-field/SPEC.md)
- [ ] Filled-in lines to confirm on Today and in the weekly email, and a jobs card on Today — parity — [spec](features/profile-confirm-lines/SPEC.md)
- [ ] Intros from a profile without Village, and the finer intro rules — parity — [spec](features/intros-from-profile/SPEC.md)
- [ ] Reply by email for messages, intro threads and asks — parity — [spec](features/reply-by-email/SPEC.md)

## Later (someday / deferred)
- [ ] Admin console home, member-view switch, mail page lists and asks admin page — parity — [spec](features/admin-console/SPEC.md)
- [ ] Asks board tabs, search, pin and reopen — parity — [spec](features/asks-board-tools/SPEC.md)
- [ ] Search and Village fallbacks: member-profile search, search cache, city filter, Village cancel on disconnect — parity — [spec](features/search-without-village/SPEC.md)
- [ ] The two welcome questions — parity — [spec](features/welcome-questions/SPEC.md)
- [ ] Invites when email is off: mailto and "Copy all links" — parity — [spec](features/invite-fallbacks/SPEC.md)
- [ ] Hosting and data settings: region, data-protection contact, agreement link — parity — [spec](features/hosting-data-settings/SPEC.md)
- [ ] Managed-plan sign-up on the website — parity — [spec](features/site-signup/SPEC.md)
- Gaps neither product had (merge plan): Google/Microsoft sign-in and SSO, groups inside one community, CRM export, events, other languages.

## Done
- [x] 2026-11-10 — Directory filters, intro reminder, email setup check, Village settings and four follow-ups — [PR #19](https://github.com/VillageHQ/community/pull/19)
- [x] 2026-11-10 — Job board: hiring tools, hourly pull, public board and website widget — [PR #21](https://github.com/VillageHQ/community/pull/21)
- [x] 2026-11-10 — Slack and Discord posts, Slack /ask, Perks — [PR #18](https://github.com/VillageHQ/community/pull/18)
- [x] 2026-11-09 — Today home and the weekly email — [PR #17](https://github.com/VillageHQ/community/pull/17)
- [x] 2026-11-09 — Profile fill-in, monthly credit cap, asks from empty searches — [PR #16](https://github.com/VillageHQ/community/pull/16)
- [x] 2026-11-09 — Asks that reach the members who can help — [PR #15](https://github.com/VillageHQ/community/pull/15)
- [x] 2026-11-09 — Partner report — [PR #14](https://github.com/VillageHQ/community/pull/14)
- [x] 2026-11-09 — Reliable email and safe timed jobs — [PR #13](https://github.com/VillageHQ/community/pull/13)
- [x] 2026-11-09 — Sign in by emailed link, invites from a list or CSV — [PR #12](https://github.com/VillageHQ/community/pull/12)
- [x] 2026-11-09 — Licence switched to AGPL-3.0 — [PR #11](https://github.com/VillageHQ/community/pull/11)
- [x] 2026-11-09 — Double opt-in intros with outcomes — [PR #10](https://github.com/VillageHQ/community/pull/10)
- [x] Before the merge — Village SDK, Asks board, sealed Village secret, module switches, VPS installer, architecture, landing page — PRs #1–#7, #9

## Founderhall parity map
Every Founderhall feature, once, in the order of the Founderhall inventory. **done** = on main (with what ships it;
"Community" = Community had it before the merge) · **dropped** = not carried over on purpose (the merge plan's
reason, or the owner's later brief where it says so) · **open** = not on main yet (with its spec or build). Checked against the code on main on 2026-11-10.

### Marketing site
- **open** · One-page marketing site — Community's `site/` page is on main; Founderhall's fund-first story comes with the one-site build
- **dropped** · Animated phone replay / motion — GSAP is not open source (merge plan revision 8); `site/` keeps Community's own tour
- **dropped** · Pricing table — the owner's one-site brief (no prices on the page) overrides the merge plan, which kept pricing
- **open** · Sign-up form — [site-signup](features/site-signup/SPEC.md)
- **open** · Confirmation email — [site-signup](features/site-signup/SPEC.md)
- **open** · Anti-abuse — [site-signup](features/site-signup/SPEC.md)
- **open** · CSV export of sign-ups — [site-signup](features/site-signup/SPEC.md)
- **open** · Security headers — a self-only CSP in `site/index.html` (Community); no nosniff or frame-ancestors, which need a server: [site-signup](features/site-signup/SPEC.md)
- **dropped** · Health check — `site/` is static with no server; the app has `/api/health` (Community)

### Setup, install and first-run admin
- **done** · `install.sh` one-command installer — `install.sh`, `deploy/vps/` (Community)
- **done** · Docker — `docker-compose.yml`, `deploy/vps/` (Community)
- **done** · Manual run — `src/platform/database/migrate-on-boot.ts` (Community)
- **dropped** · First admin from env — Community's setup token and admin recovery replace it (merge plan)
- **dropped** · Fresh admin link CLI — Community's setup token and admin recovery replace it (merge plan)
- **open** · Launch checklist — `src/shell/admin-setup-steps.ts` ends on the first partner report (PR #14); the mail step is missing: [admin-console](features/admin-console/SPEC.md)
- **done** · "Set up" hub — folded into admin Settings, as the merge plan says
- **open** · Settings — name, logo, accent (Community); region, data-protection email, message default: [hosting-data-settings](features/hosting-data-settings/SPEC.md)
- **dropped** · Mail-off fallback ("Sign-in links") — merge plan: no admin "copy sign-in links" page, ever
- **done** · Config via env or `.env` — `.env.example`, `src/platform/environment.ts` (Community)

### Auth and accounts
- **done** · Magic-link sign-in — `src/platform/auth/`, `/sign-in/link` (PR #12)
- **done** · Invite-only access — `/sign-up` is invite-only (Community)
- **done** · Invites — `src/modules/members/service-bulk-invites.ts`, 14-day single-use links (PR #12, Community)
- **open** · "Send from your email" invites — one "Copy link" per invite only: [invite-fallbacks](features/invite-fallbacks/SPEC.md)
- **done** · Sessions — Better Auth, `src/platform/auth/session.ts` (Community)
- **done** · Sign out — `src/platform/auth/sign-out.ts` (Community)
- **done** · Roles — `src/platform/auth/roles.ts`, admin role in Manage (Community)
- **open** · Demo login — the demo-mode build ([PR #25](https://github.com/VillageHQ/community/pull/25))
- **done** · Passwords / OAuth / SSO / 2FA / recovery — password, reset and admin recovery (Community); OAuth, SSO and 2FA are on the "gaps neither product had" list

### Member onboarding and profile
- **open** · Welcome step 1 — card fields are all optional: [welcome-questions](features/welcome-questions/SPEC.md)
- **open** · Welcome step 2: privacy — the lookup question (PR #16) and share-network step (Community) are on main; hide me and the required "accept intro asks" come with [PR #20](https://github.com/VillageHQ/community/pull/20)
- **done** · Profile fields — `src/modules/members/schema.ts` (stage, sector, cohort, can help with…), own words win (PR #16, PR #19)
- **done** · Inline field edit — a form on Your card (Community), not in place
- **done** · Source labels — filled-in label and date on the profile (PR #16)
- **done** · Hide Village lines — `/api/profile/fill-in`, hides survive refreshes (PR #16)
- **open** · Confirm Village facts on Today — Today's card is never filled: [profile-confirm-lines](features/profile-confirm-lines/SPEC.md)
- **done** · Faces and company logos — face and logo fill-in (PR #16)
- **done** · Our jobs on My profile — `/jobs/yours` (PR #21)
- **done** · Photo upload — `/api/profile/avatar` (Community)

### Directory
- **done** · Member directory — `/members` (Community)
- **open** · Search and filters — stage, sector, cohort, freshness (PR #19); no city filter: [search-without-village](features/search-without-village/SPEC.md)
- **open** · Member profile page — Message only; no "Ask for an intro" or "Who X can introduce you to": [intros-from-profile](features/intros-from-profile/SPEC.md)
- **open** · Visibility — emails stay hidden (Community); hide from the directory comes with [PR #20](https://github.com/VillageHQ/community/pull/20)
- **done** · Jobs link — a Jobs entry in the navigation (PR #21) instead of a directory link

### Village integration
- **done** · Village client (the only HTTP seam) — `src/platform/village/client.ts` over `@villagehq/sdk` (PR #9)
- **done** · Admin › Village: keys — sealed secret (Community, PR #6)
- **open** · Admin › Village: settings — monthly cap (PR #16), scope, introducers, service email (PR #19); embed modes dropped (popup only, merge plan); data region and agreement link: [hosting-data-settings](features/hosting-data-settings/SPEC.md)
- **open** · Test connection — keys are checked on save, no test button: [admin-console](features/admin-console/SPEC.md)
- **done** · Profile fill-in (enrichment) — `src/modules/network/service-fill-in.ts`, nightly, consent-gated (PR #16)
- **done** · Connect my network — `/api/network/sync-token` (Community)
- **done** · Pooling consent through a Village Group — `/api/network/consent` (Community)
- **open** · Disconnect — leaves the group, no Village user cancel: [search-without-village](features/search-without-village/SPEC.md)
- **open** · Warm-path search — paths, "You already know" (Community, PR #19); no 10-minute search cache: [search-without-village](features/search-without-village/SPEC.md)
- **open** · No key / no path fallbacks — "Ask the community" (PR #16); no member-profile search: [search-without-village](features/search-without-village/SPEC.md)
- **done** · Credit ledger and caps — `src/platform/village/credit-ledger.ts`, 80% and 100% emails (PR #16, Community)
- **done** · Nudge — `src/modules/network/service-nudge.ts`, once per 30 days (PR #16)
- **dropped** · "Intros via Village" — dead Founderhall client code (merge plan)

### Intros
- **open** · Ask for an intro from a profile — intros start only from search paths: [intros-from-profile](features/intros-from-profile/SPEC.md)
- **done** · One-step ask from search — path picture and one ask dialog (Community, PR #10)
- **dropped** · Guided ask (`/ask`) — merge plan: four ways to ask become one ask path
- **open** · Connector step — decline kinds and the target's email (PR #10); no YES/NO reply by email: [reply-by-email](features/reply-by-email/SPEC.md)
- **done** · Target step — `email-target.ts`, the public page, the day-4 reminder (PR #10, PR #19)
- **done** · Target opt-out — "stop all asks", `opt-out.ts` (PR #10)
- **open** · Introduced email — to the asker and the person asked only, no reply-into-thread: [intros-from-profile](features/intros-from-profile/SPEC.md)
- **open** · Expiry — 14 days for the whole intro, at least 7 for the person asked, not 7 per step: [intros-from-profile](features/intros-from-profile/SPEC.md)
- **done** · Kind declines — `REQUESTER_STATES` (PR #10)
- **done** · Withdraw — the allowance comes back (PR #10, PR #15)
- **open** · Outcome question — at 14 days with a reminder (PR #10); the admin can't set the day: [intros-from-profile](features/intros-from-profile/SPEC.md)
- **open** · Intros page / tracker — `/intros`, `/intros/<id>`; no event history: [intros-from-profile](features/intros-from-profile/SPEC.md)
- **done** · Weekly ask allowance — default 5 in `src/modules/asks/contract.ts`, enforced in `src/shell/ask-helpers.ts` (PR #15)
- **done** · Connector weekly cap / open-ask cap — `CONNECTOR_WEEKLY_CAP = 10` in `src/modules/intros/service.ts` (PR #15)

### Asks and updates
- **done** · Post an ask or an update — `ask` and `update` kinds (Community, PR #15)
- **done** · Helper routing (path check) — `src/modules/asks/service-helpers.ts` (PR #15)
- **open** · Helpers emailed — one email with unsubscribe (PR #15); a reply doesn't post under the ask: [reply-by-email](features/reply-by-email/SPEC.md)
- **done** · "I can help" — `/api/asks/offer`, `/api/asks/know-someone` (PR #15)
- **done** · Ask via helper — `/api/asks/ask-helper` (PR #15)
- **open** · Answers (comments) — in the app, reportable (PR #15); not by email: [reply-by-email](features/reply-by-email/SPEC.md)
- **open** · Tabs and archive search — [asks-board-tools](features/asks-board-tools/SPEC.md)
- **open** · Status — close with an outcome, renew, admin remove (Community, PR #15); no pin or reopen: [asks-board-tools](features/asks-board-tools/SPEC.md)
- **open** · Admin › Asks & digest — schedule and allowance are on main (PR #17, PR #15); no stats or moderation page: [admin-console](features/admin-console/SPEC.md)
- **done** · Skip ("Not this week") — `/api/asks/skip` (PR #17)
- **dropped** · Reactions, audiences, editing posts — Founderhall didn't have them; the feed has reactions and editing (Community)

### Messaging and DMs
- **done** · Member-to-member DMs — `src/modules/messages` (Community)
- **open** · Intro threads with guests — [reply-by-email](features/reply-by-email/SPEC.md)
- **done** · DM email notifications — `src/modules/messages/email.ts`, 15-minute batch (PR #13)
- **open** · Reply by email — the weekly email only: [reply-by-email](features/reply-by-email/SPEC.md)
- **open** · "Who can message me" — [PR #20](https://github.com/VillageHQ/community/pull/20)
- **done** · Admins can't read DMs — no admin route to threads (Community)
- **done** · Max message 4,000 chars — `MESSAGE_LIMITS` (Community)

### Notifications and the weekly email
- **open** · Today (member home) — `src/shell/today.ts` (PR #17); no jobs card, the lines-to-confirm card stays empty: [profile-confirm-lines](features/profile-confirm-lines/SPEC.md)
- **done** · Weekly digest — `src/shell/weekly-email.ts`, day, hour and time zone (PR #17)
- **open** · Digest reply codes — HELP, SKIP, YES, NO (PR #17); no RIGHT, HIDE, FIX: [profile-confirm-lines](features/profile-confirm-lines/SPEC.md)
- **done** · Digest signed links — `/weekly`, one answer per item (PR #17)
- **done** · Digest preview and test — `/admin/weekly-email` (PR #17)
- **done** · Email prefs — per topic on Your card, `/api/email/preferences` (PR #13)
- **done** · One-click unsubscribe — `src/platform/email/unsubscribe.ts` (PR #13)
- **done** · Other emails — `src/platform/email/kinds.ts`; the delete-request email gives way to the real delete in PR #20
- **dropped** · In-app notification centre / push — Founderhall didn't have one; badges and unread counts (Community)

### Job board
- **done** · Link a hiring tool — `src/modules/job-board/rules-feeds.ts` (PR #21)
- **done** · 12 public ATS feeds (no key) — `rules-feeds.ts` (PR #21)
- **done** · Hourly pull — `service-pull.ts` (PR #21)
- **done** · Manual jobs — `/api/job-board/jobs/add`, `remove` (PR #21)
- **done** · Founder controls — pull, hide, remove (PR #21)
- **done** · Members' board — `/jobs` (PR #21)
- **done** · Public board — `/public/jobs`, off until an admin turns it on (PR #21)
- **done** · Website widget — `/api/job-board/widget.js` (PR #21)
- **done** · Admin › Job board — `/admin/jobs` (PR #21)

### Perks
- **done** · Admin › Perks — `/admin/perks`, `src/modules/perks/service.ts` (PR #18)
- **done** · `/perks` page — (PR #18)
- **done** · Today card and menu entry — `PerksCard`, `perks/manifest.ts` (PR #18)

### Integrations
- **done** · Slack connect — `src/modules/chat`, sealed tokens (PR #18)
- **done** · Discord connect — (PR #18)
- **done** · Outbound posts — `src/modules/chat/service-posts.ts` (PR #18)
- **done** · Slack `/ask` slash command — `src/shell/slack-ask.ts` (PR #18)
- **done** · Retry and errors — `src/modules/chat/client.ts` (PR #18)
- **open** · Inbound mail webhook — Resend only (PR #13, PR #17); no Postmark, MIME or shared key: [reply-by-email](features/reply-by-email/SPEC.md)
- **open** · Exports — partner report CSV and print (PR #14); member JSON comes with [PR #20](https://github.com/VillageHQ/community/pull/20)
- **done** · Job board widget — (PR #21)
- **dropped** · Outgoing webhooks / public REST API / Zapier — Founderhall didn't have them
- **dropped** · Calendar, CRM, Airtable, HubSpot, LinkedIn import — Founderhall didn't have them; CRM export is on the gaps list

### Admin
- **open** · Console home — [admin-console](features/admin-console/SPEC.md)
- **done** · Members list — `/admin/members` (Community)
- **done** · Member actions beyond resend — remove, role, unban, reinvite (Community); the admin delete comes with PR #20
- **done** · Invites — the legal basis for fill-in is recorded once for the community (PR #16)
- **done** · Import members (CSV) — up to 20,000 rows (PR #12)
- **dropped** · Intro log — merge plan: one partner report instead of separate pages (PR #14)
- **done** · Partner report — `src/modules/admin/service-partner-report.ts` (PR #14); no "top sectors" breakdown
- **done** · Send report to partners — up to 20 addresses (PR #14)
- **open** · Admin › Mail — DNS check and test send (PR #19); no do-not-send list, counts or sending log: [admin-console](features/admin-console/SPEC.md)
- **done** · Admin › Village — the Settings Village card, `/admin/credits` (Community, PR #16, PR #19)
- **open** · Admin › Asks & digest, digest preview — digest preview done (PR #17); no asks admin page: [admin-console](features/admin-console/SPEC.md)
- **done** · Admin › Integrations — `/admin/chat` (PR #18)
- **done** · Admin › Job board, Perks — `/admin/jobs` (PR #21), `/admin/perks` (PR #18)
- **done** · Audit log — `/admin/audit-log` (Community)
- **open** · Branding — accent, logo, dark mode (Community); "Network by Village" off member screens with the look-theme build
- **open** · Founder view switch — [admin-console](features/admin-console/SPEC.md)

### Privacy, consent, data export and delete
- **done** · Consent gate for enrichment — the legal basis plus the member's "don't look me up" (PR #16)
- **open** · "Your data" page — [PR #20](https://github.com/VillageHQ/community/pull/20)
- **open** · Export my data (JSON) — [PR #20](https://github.com/VillageHQ/community/pull/20)
- **open** · Ask to delete my account — a real delete in [PR #20](https://github.com/VillageHQ/community/pull/20)
- **open** · Hosting & data settings — [hosting-data-settings](features/hosting-data-settings/SPEC.md)
- **done** · Pooling consent — group join on consent (Community)
- **done** · Do-not-send list — bounces and complaints (PR #13), intro opt-out (PR #10)
- **done** · Data minimisation of outside emails after 90 days — done differently: the person's email is cleared when the intro closes, and the outbox is pruned daily (PR #10, PR #13)

### Security
- **done** · CSRF — same-origin check on every POST (Community)
- **done** · Public POST allow-list — open routes declared in the route kit (Community)
- **done** · Rate limits — database rate limits (Community), no shared sign-in bucket (PR #13)
- **done** · Hashed tokens — sign-in link and invite hashes (PR #12, Community)
- **done** · Signed email tokens — weekly email and unsubscribe tokens (PR #13, PR #17)
- **done** · Secrets at rest — `src/platform/secrets`, chat tokens sealed (Community, PR #18)
- **done** · Security headers — global CSP with per-route exceptions (Community, PR #18, PR #21)
- **done** · Body limits — `src/platform/http/body-limit.ts` (Community, PR #13)
- **done** · Static path traversal guard — Next.js serves static files (Community)
- **done** · Proxy awareness — `src/platform/http/client-ip.ts` (Community, PR #13)

### Languages and accessibility
- **dropped** · i18n — Founderhall had none; other languages are on the gaps list
- **done** · Time zones — the weekly email's time zone (PR #17)
- **done** · Accessibility — skip link, reduced motion (Community)
- **done** · Mobile — phone tab bar (Community)

### Demo mode
- **open** · Demo seed — the demo-mode build ([PR #25](https://github.com/VillageHQ/community/pull/25))
- **open** · Long intro history seed — the demo-mode build ([PR #25](https://github.com/VillageHQ/community/pull/25))
- **open** · Demo login and banner — the demo-mode build ([PR #25](https://github.com/VillageHQ/community/pull/25))
- **open** · Nightly reset — the demo-mode build ([PR #25](https://github.com/VillageHQ/community/pull/25))
