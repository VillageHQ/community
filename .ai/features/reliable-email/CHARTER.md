# Reliable email and safe timed jobs: charter

Approved scope: the owner's build plan for merging Founderhall's strengths into Community (wave 1, part 3). The
maintainer agreed and reviews after merge. This page restates that brief; it is the scope of this build.

## Direction

The platform foundation that later parts (weekly digest, reminders, outcome emails) build on. Today an email that
fails, or a server that restarts between "state changed" and "email sent", loses the email; nothing runs on a timer;
a new direct message sends no email; nobody can unsubscribe; and one person's wrong passwords can lock everyone out
of signing in when no client-IP header is set.

In:

1. **Email outbox.** Outgoing email is a row written in the same transaction as the change that causes it. A sender
   claims due rows (`FOR UPDATE SKIP LOCKED`), sends through the existing Resend client with the row id as the
   Idempotency-Key, retries with backoff, marks each row sent or failed, and gives up after a fixed number of tries
   with a notice the admin can see. Invite, intro asked/accepted/declined, password reset and email confirmation move
   onto it. An admin who sends an invite still sees right away whether the first try went out. The intro "asked" email is no longer marked sent before it is sent. Intros edits stay minimal (another
   part edits that module in parallel).
2. **Job runner.** One runner for timed work: a database lease so two servers never run the same job at once, an
   in-process "already running" guard, and a tick endpoint protected by a shared secret for hosts without a
   long-running process. The VPS install ticks itself every minute. First jobs: the outbox sender, and a sweep that
   expires due intros so admin counts are right (each write keeps its own guards).
3. **Direct-message email.** At most one email per conversation per 15 minutes, with a per-member switch.
4. **Unsubscribe.** List-Unsubscribe and one-click POST headers on non-transactional email, a per-kind preference, a
   do-not-send list, and a Resend webhook (signature checked) that adds bounced and complaining addresses to it.
5. **Sign-in lockout.** With no client-IP header, failed sign-ins no longer share one bucket: the limit is keyed per
   email, plus per IP when the IP is known. The setup-token and invite limiters stay safe.

Out: digests, reminders, outcome emails (later parts); new admin screens beyond the failed-email notice.

## Deciding facts (assumptions)

- **Sending right away still happens.** After the transaction commits, the request nudges the sender in the
  background, so email is as quick as today on every host; the timed job is the safety net for anything that failed.
- **Transactional vs not.** Invite, email confirmation and password reset are transactional: no unsubscribe header,
  and the do-not-send list doesn't stop them (the person asked for them; a bounced address just bounces again).
  Intro and direct-message emails are non-transactional: they carry the unsubscribe headers and honour preferences
  and the whole do-not-send list.
- **Asks need no sweep.** An ask's expiry is not stored; it is worked out from `listed_at` at read time, and the asks
  module forbids a sweep. Its counts are already right, so the sweep covers intros only.
- **The tick secret.** `JOBS_TICK_SECRET` (or the host's `CRON_SECRET`) protects the tick endpoint. When neither is
  set the endpoint uses a random secret the app stores in its own settings, which only the app's own self-tick knows.
- **Lockout keys.** Sign-in failures are counted per email always, and per client IP only when a trusted IP header is
  configured. The setup-token and invite limiters already refuse to share a bucket across everyone: they keep their
  own keys, unchanged.

## Architecture

- `src/platform/email/`: `outbox` table, enqueue (takes a transaction), sender job, unsubscribe tokens and headers,
  preferences, do-not-send list, Resend webhook check.
- `src/platform/jobs/`: `job_lease` table, runner, job list type, self-tick.
- Modules contribute jobs through `ModuleIntegration.jobs`, the same way they contribute badges and hooks. The tick
  route (app layer) runs platform jobs plus the jobs of enabled modules.
- New routes: `POST /api/jobs/tick`, `GET/POST /unsubscribe` (page + one-click), `POST /api/email/resend-webhook`.
- Migration `0015`.

## Journeys and tests

- Invite, intro ask/answer, password reset, email confirmation: existing integration tests extended to read the outbox.
- New integration tests: outbox send/retry/give-up and two senders at once; job lease; DM email throttle; unsubscribe;
  webhook signature and suppression; sign-in lockout per email.
- `pnpm lint`, `pnpm typecheck`, architecture tests.

## Proof and estimate

Proof: real HTTP output against fake Resend (down, then up: one email each, no duplicates), a screenshot of the email
settings switch and the unsubscribe page at 390 and 1280 px. Build about 6 hours, tests about 1 hour.
