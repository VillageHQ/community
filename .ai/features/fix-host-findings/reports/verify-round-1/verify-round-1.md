# fix-host-findings: independent check, round 1

Checked: 2026-11-12, branch `absi-agent/fix-host-findings` at `9d1c4cb`. I used the production build in `.next` (`next start -p 3123`), throwaway Postgres `community-fhf-pg`, and a fresh database per run (verify1, verify2, verify3). The app ran in demo mode with mail and Village faked. All people are made up, at example.com. I ran one server and one browser at a time, and stopped each one at the end.

## Results

| # | Fix | Result |
|---|-----|--------|
| 1 | HSTS from `src/proxy.ts`: sent when APP_URL is https, not sent when APP_URL is http | **PASS** |
| 2 | No pg "client is already executing a query" warning: on the first timed-job tick, when Sam posts an ask, and when Sam makes an intro ask | **PASS** |
| 3a | Fly warning at start: once with FLY_APP_NAME and no CLIENT_IP_HEADER, never otherwise | **PASS** |
| 3b | README "Deploy on Fly.io" section | **PASS** (notes below) |
| 4 | Revoked invites on Admin › Invites: pill, dates, Resend without Revoke, Resend reopens, the edge cases | **PASS** (one minor edge and some notes below) |

## 1. HSTS (run A, then run B)
- **Run A, `APP_URL=https://community.example.com`.** These pages all sent `strict-transport-security: max-age=31536000; includeSubDomains`: `/signin` 200, `/today` 307, `/` 307, `/no-such-page` 404, `/admin/invites` 307, `/setup`, `/public/board`, `/jobs`, `/invite?token=…`, `/auth?token=…`.
  - `/api/health`, `/icon.svg` and router prefetches sent no HSTS. That is expected, because the matcher skips them.
  - Evidence: `run-a-https-fly.txt`.
- **Run B, `APP_URL=http://localhost:3123`.** No response carried HSTS: `/signin`, `/today`, `/`, `/no-such-page`, `/admin/invites`, `/invite?token=bogus` (410) and `/api/health`.
  - In the browser, signed in as Sam, `fetch('/today')` answered 200 with `strict-transport-security` null.
  - Evidence: `run-b-http-fly-header.txt`.
- **Side note, not from this change.** With an https APP_URL the server can't reach on its own, a bad `/invite` or `/auth` link answers 200 instead of 410. The proxy fetches the gone-link page from APP_URL, and that fetch fails here. On a real host APP_URL points back at the app.

## 2. pg overlapping-query warning
- **Run A** started with `NODE_OPTIONS=--trace-deprecation`, demo mode and `JOBS_SELF_TICK=true` on fresh database verify1 (boot 22:35:44).
  - The first tick finished at 20:36:47Z. `job_lease` shows all 11 jobs finished with an empty `last_error`.
  - The log has 0 "already executing a query" lines. Before the fix, `recorded-run-before.txt` shows the warning on the first tick.
- **Run B** used the same flags on fresh database verify2.
  - The first tick finished at 20:38:19Z, with 11 jobs and no errors. Later ticks of chat-posts and email-outbox ran at 20:42Z.
  - As Sam, I posted an ask from Asks ("Looking for an intro to a fintech compliance lawyer…"). It redirected to `/asks/<id>?m=posted`.
  - As Sam, I asked Amara for an intro to "Jordan Example". It redirected to `/intros/<id>?m=asked`.
  - I opened `/ask`, `/today` and `/intros`, which read the weekly allowance.
  - The log still has 0 warnings.
- Evidence: `run-a-https-fly.txt`, `run-b-http-fly-header.txt`.

## 3. Fly warning and README
- **Run A, `FLY_APP_NAME=fhf-verify` and no CLIENT_IP_HEADER.** Exactly 1 line, printed at start: "Running on Fly.io without CLIENT_IP_HEADER, … Set CLIENT_IP_HEADER=fly-client-ip (README: Deploy on Fly.io)." It did not repeat across ticks.
- **Run B, with `CLIENT_IP_HEADER=fly-client-ip` added.** No Fly line.
  - Better Auth logs one WARN that it "could not determine a client IP". That is expected locally, because nothing sends a `fly-client-ip` header.
- **Run C, without FLY_APP_NAME.** No Fly line (`run-c-no-fly.txt`).
- **README, Deploy › "Deploy on Fly.io"** (lines 42-54). It lists:
  - `deploy/vps/Dockerfile` in `fly.toml [build]`
  - health check `/api/health` on port 3000, which matches the Dockerfile's `EXPOSE 3000` and `PORT=3000`
  - auto-stop off
  - `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_URL`, `SETUP_TOKEN`, `JOBS_SELF_TICK=true`, `CLIENT_IP_HEADER=fly-client-ip`
  - one machine with 1 GB (shared-cpu-1x)

  It reads correctly. The Fly row in the client-IP table and the APP_URL row in the environment table (which mentions HSTS) agree with it.
  - Notes only: the README has two blank lines after step 3. The Fly section treats `BETTER_AUTH_SECRET` as required, while the environment table says "No, overrides the generated secret". Both are reasonable, but they read differently.

## 4. Revoked invites (run B, signed in as Maya, http APP_URL)
- **Main flow.**
  - I invited `Pat Rivera, pat.rivera@example.com`, a long address `alexandria.montgomery-fitzwilliam.operations.lead@subsidiary-holdings.example.com`, and `lee.expired@example.com`. The page said "3 invited."
  - I revoked Pat: Revoke, then "Yes, revoke". Pat stayed listed with a **Revoked** pill and "Sent 12 Nov, revoked 12 Nov", with Resend and no Revoke link.
  - I made lee.expired expired with SQL. It shows the **Expired** pill, "ended 11 Nov", and both Resend and Revoke.
  - Screenshots: `01-invites-revoked-expired-1280.png` and `02-invites-revoked-expired-390.png`.
- **Resend on revoked Pat.** The page said "Invite sent again. The old link no longer works." Pat's row now has no pill, "Sent 12 Nov, ends 26 Nov", and both Resend and Revoke.
  - In the database: `revoked_at` is NULL, `token_hash` changed (dd28a4… to 3739bf…), `expires_at` is now +14 days, and there is a new `email_outbox` row (status `skipped`, because mail is faked in demo).
  - Screenshot: `07-after-resend-pat-open-1280.png`.
- **Revoke, then invite the same email again** (Ruby, after revoking her in the two-tab test).
  - The page said "1 invited." The revoked Ruby row left the list, and one open Ruby row remains.
  - On a stale tab, Resend on the old revoked Ruby row answered 409 with a plain message: "This person already has a newer invite. Use Resend on that one." The old row did not change. Screenshot: `06-stale-resend-after-reinvite.png`.
- **Revoke twice from two tabs** (Ruby).
  - Tab 1 revoked her. Tab 2, still showing the old page, then pressed "Yes, revoke". It answered 409 with "This invite changed. Reload the page and check it again." `revoked_at` kept tab 1's time.
  - Screenshots: `04-double-revoke-stale-tab-1034.png` and `05-double-revoke-message-1034.png`. The second tab opened at 1034 px wide.
- **An expired invite, revoked, then resent.** It showed Revoked (the revoked pill wins over expired), then reopened with `expires_at` 14 days ahead.
- **A long email on a 390 px phone.** There is no sideways scroll (scrollWidth equals clientWidth, 380). The pill and the name stay on one line, and the name is cut short with an ellipsis. The address and the "Sent …, revoked …" line stay readable. Screenshot: `03-invites-long-email-revoked-390.png`.
- **Compared with Founderhall** (`fh-reference/shots/admin-invites-390.png`, `copy/admin-invites.md`). The rows look the same: envelope icon, serif name, email, and Resend on the right. Founderhall has no Revoke, Expired or Revoked. Those are Community-only, as the page comment says. Nothing is broken or overlapping.

### Problems and notes
1. **Minor edge: a revoked invite for someone who is already a member stays listed, and its Resend always refuses.**
   - To reproduce:
     1. `insert into invite (email, token_hash, invited_by_name, expires_at, revoked_at, created_at) values ('sam.lee@example.com','verify-fake-hash-1','Maya Ortiz', now()+interval '10 days', now(), now()-interval '20 days')`
     2. Open /admin/invites. Sam is listed under "Waiting to sign in" as Revoked, with Resend.
     3. Press Resend. It answers 409: "This person already has an account. If they were removed, open them in the list above…". There is no "list above" on this page.
   - `readListedInvites` hides a revoked invite only when there is a later or open invite for the same email, not when the email already has an account.
   - I found no UI path that leads here: import creates invites, and accepting an invite supersedes the revoked one. So this is low priority. It would matter only if a member joins without using an invite to that address.
2. **Note: Resend on a revoked row sits in the Revoke column.** At 1280 px, the revoked row's Resend lines up under the other rows' "Revoke", not under their "Resend" (`01-…-1280.png`, Pat's and alexandria's rows). It looks slightly off, but nothing overlaps.
3. **Note: the wording differs.** After revoking, the message says "Invite cancelled. Its link no longer works.", but the pill says "Revoked".
4. **Note, not from this change.** At 1034 px (`04-…`), the rows cut off the date line ("Sent 12 Nov, ended …"), which hides the date the code comment means to keep visible. It is fine at 390 and 1280.
5. **Note.** Re-inviting by bare email drops the earlier invitee name: Ruby shows as "ruby.haas@example.com". That is expected for a bare-email paste.

## Evidence files
- `01-invites-revoked-expired-1280.png`, `02-invites-revoked-expired-390.png`: a revoked and an expired invite at both widths.
- `03-invites-long-email-revoked-390.png`: a long address, revoked, at 390 px.
- `04-double-revoke-stale-tab-1034.png`, `05-double-revoke-message-1034.png`: revoking twice from two tabs.
- `06-stale-resend-after-reinvite.png`: Resend on a stale revoked row after the same email was invited again.
- `07-after-resend-pat-open-1280.png`: Pat open again after Resend.
- `run-a-https-fly.txt`, `run-b-http-fly-header.txt`, `run-c-no-fly.txt`: full server logs, headers and `job_lease` tables.
