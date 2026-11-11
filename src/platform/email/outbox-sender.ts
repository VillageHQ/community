import { and, eq, inArray, lt, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { logError, readErrorReason } from "../observability/route-logging.ts";
import { runAfterResponse } from "../observability/after-response.ts";
import { DEMO_EMAIL_NOTE, isDemoMode } from "../demo/mode.ts";
import { readEmailTopic } from "./kinds.ts";
import { isEmailWanted, OUTBOX_STATUSES } from "./outbox.ts";
import { readResendConfig, sendResendEmail, type ResendConfig } from "./resend.ts";
import { emailOutbox } from "./schema.ts";
import { buildUnsubscribeParts } from "./unsubscribe.ts";
import { composeSenderAddress, readMailSettings } from "./mail-settings.ts";
import { readBranding } from "../branding/branding.ts";

export const MAXIMUM_SEND_ATTEMPTS = 6;
const MINUTE_MS = 60_000;
// The wait after each failed try. After the last one the email is given up and the admin sees it.
const RETRY_DELAYS_MS = [1, 5, 15, 60, 180].map((minutes) => minutes * MINUTE_MS);
// A claimed row that is still "sending" after this was dropped by a crash, so it is due again.
// It must outlast a whole batch of slow sends (20 × the 8-second timeout).
const CLAIM_TIMEOUT_MS = 5 * MINUTE_MS;
const BATCH_SIZE = 20;
const MAXIMUM_ERROR_LENGTH = 300;
const FINISHED_RETENTION_MS = 30 * 24 * 60 * MINUTE_MS;
const FINISHED_STATUSES = [OUTBOX_STATUSES.sent, OUTBOX_STATUSES.failed, OUTBOX_STATUSES.skipped];

type ClaimedEmail = typeof emailOutbox.$inferSelect;

export type OutboxSendSummary = { sent: number; retrying: number; failed: number; skipped: number };

export function readRetryDelay(attempts: number) {
  return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length) - 1] ?? MINUTE_MS;
}

// SKIP LOCKED lets two senders run at once: each takes rows the other hasn't, and the claim
// pushes next_attempt_at forward, so a row is never claimed twice while it is being sent.
async function claimDueEmails(database: Database, onlyId: string | null) {
  const claimTimeout = sql.raw(`interval '${CLAIM_TIMEOUT_MS / 1000} seconds'`);
  // One named row is tried now even inside its backoff, unless another sender holds it.
  const isDue = onlyId
    ? sql`id = ${onlyId} and (status = 'pending' or (status = 'sending' and next_attempt_at <= now()))`
    : sql`status in ('pending', 'sending') and next_attempt_at <= now()`;
  const result = await database.execute<{ id: string }>(sql`
    with due as (
      select id from email_outbox
      where ${isDue}
      order by next_attempt_at
      limit ${BATCH_SIZE}
      for update skip locked
    )
    update email_outbox
    set status = 'sending', attempts = email_outbox.attempts + 1, next_attempt_at = now() + ${claimTimeout}
    from due
    where email_outbox.id = due.id
    returning email_outbox.id
  `);
  const ids = result.rows.map(({ id }) => id);
  if (ids.length === 0) return [];
  return database.select().from(emailOutbox).where(inArray(emailOutbox.id, ids));
}

function isStillClaimed(email: ClaimedEmail) {
  return and(eq(emailOutbox.id, email.id), eq(emailOutbox.status, OUTBOX_STATUSES.sending), eq(emailOutbox.attempts, email.attempts));
}

// A finished row drops its body: invite, confirmation and reset links must not outlive the send.
async function finish(database: Database, email: ClaimedEmail, status: string, lastError: string | null = null) {
  await database
    .update(emailOutbox)
    .set({ status, lastError, finishedAt: new Date(), html: "", text: "" })
    .where(isStillClaimed(email));
}

export async function pruneFinishedEmails(database: Database, now = new Date()) {
  await database
    .delete(emailOutbox)
    .where(and(inArray(emailOutbox.status, FINISHED_STATUSES), lt(emailOutbox.finishedAt, new Date(now.getTime() - FINISHED_RETENTION_MS))));
}

async function scheduleRetry(database: Database, email: ClaimedEmail, error: unknown) {
  const lastError = readErrorReason(error).slice(0, MAXIMUM_ERROR_LENGTH);
  logError("email-outbox-try-failed", error);
  if (email.attempts >= MAXIMUM_SEND_ATTEMPTS) {
    logError("email-outbox-gave-up", error);
    await finish(database, email, OUTBOX_STATUSES.failed, lastError);
    return OUTBOX_STATUSES.failed;
  }
  await database
    .update(emailOutbox)
    .set({ status: OUTBOX_STATUSES.pending, lastError, nextAttemptAt: new Date(Date.now() + readRetryDelay(email.attempts)) })
    .where(isStillClaimed(email));
  return OUTBOX_STATUSES.pending;
}

async function composeEmail(database: Database, environment: Environment, email: ClaimedEmail) {
  const topic = readEmailTopic(email.kind);
  const base = { to: email.toEmail, subject: email.subject, idempotencyKey: email.id, replyTo: email.replyTo };
  if (!topic || !email.memberId) return { ...base, html: email.html, text: email.text };

  const { headers, htmlFooter, textFooter } = await buildUnsubscribeParts(database, environment, { memberId: email.memberId, topic });
  return { ...base, html: `${email.html}${htmlFooter}`, text: `${email.text}${textFooter}`, headers };
}

function isExpired(email: ClaimedEmail) {
  return email.expiresAt !== null && email.expiresAt.getTime() <= Date.now();
}

async function deliver(database: Database, environment: Environment, config: ResendConfig, email: ClaimedEmail) {
  if (isExpired(email)) {
    await finish(database, email, OUTBOX_STATUSES.skipped, "Expired before it could be sent.");
    return OUTBOX_STATUSES.skipped;
  }
  try {
    if (!(await isEmailWanted(database, { kind: email.kind, to: email.toEmail, memberId: email.memberId }))) {
      await finish(database, email, OUTBOX_STATUSES.skipped);
      return OUTBOX_STATUSES.skipped;
    }
    // Demo mode: the email stays in the sending log, marked, and never reaches Resend.
    if (isDemoMode(environment)) {
      await finish(database, email, OUTBOX_STATUSES.skipped, DEMO_EMAIL_NOTE);
      return OUTBOX_STATUSES.skipped;
    }
    await sendResendEmail(config, await composeEmail(database, environment, email));
  } catch (error) {
    return scheduleRetry(database, email, error);
  }
  await finish(database, email, OUTBOX_STATUSES.sent);
  return OUTBOX_STATUSES.sent;
}

const SUMMARY_KEYS = {
  [OUTBOX_STATUSES.sent]: "sent",
  [OUTBOX_STATUSES.pending]: "retrying",
  [OUTBOX_STATUSES.failed]: "failed",
  [OUTBOX_STATUSES.skipped]: "skipped",
} as const;

// The sender the admin set in Set up › Settings (from name, sending domain), over the host's RESEND_FROM_ADDRESS.
export async function readSenderConfig(database: Database, config: ResendConfig): Promise<ResendConfig> {
  const [mail, branding] = await Promise.all([readMailSettings(database), readBranding(database)]);
  return { ...config, fromAddress: composeSenderAddress(config.fromAddress, mail, branding.name) };
}

async function sendClaimed(database: Database, environment: Environment, onlyId: string | null) {
  const summary: OutboxSendSummary = { sent: 0, retrying: 0, failed: 0, skipped: 0 };
  const hostConfig = readResendConfig(environment);
  if (!hostConfig) return summary;
  const config = await readSenderConfig(database, hostConfig);

  for (const email of await claimDueEmails(database, onlyId)) {
    summary[SUMMARY_KEYS[await deliver(database, environment, config, email)]] += 1;
  }
  return summary;
}

export async function sendDueEmails(database: Database, environment: Environment) {
  let total: OutboxSendSummary = { sent: 0, retrying: 0, failed: 0, skipped: 0 };
  for (;;) {
    const batch = await sendClaimed(database, environment, null);
    total = {
      sent: total.sent + batch.sent,
      retrying: total.retrying + batch.retrying,
      failed: total.failed + batch.failed,
      skipped: total.skipped + batch.skipped,
    };
    if (batch.sent + batch.retrying + batch.failed + batch.skipped < BATCH_SIZE) return total;
  }
}

// Tries one queued email now, for a caller that tells the person whether it went out. If this
// try fails, the row stays queued and the timed sender keeps trying.
export async function sendQueuedEmailNow(database: Database, environment: Environment, id: string | null) {
  if (!id) return false;
  try {
    const { sent } = await sendClaimed(database, environment, id);
    if (sent > 0) return true;
    const [row] = await database.select({ status: emailOutbox.status, lastError: emailOutbox.lastError }).from(emailOutbox).where(eq(emailOutbox.id, id));
    // In the demo an email kept in the sending log counts as handled, so screens don't say it's retrying.
    if (isDemoMode(environment) && row?.lastError === DEMO_EMAIL_NOTE) return true;
    return row?.status === OUTBOX_STATUSES.sent;
  } catch (error) {
    logError("email-outbox", error);
    return false;
  }
}

// Sends what was just queued once the response has gone, so email is as quick as before. If
// the process dies first, the timed sender picks the rows up.
export function sendQueuedEmailsSoon(database: Database, environment: Environment) {
  if (!readResendConfig(environment)) return;
  runAfterResponse(async () => {
    try {
      await sendDueEmails(database, environment);
    } catch (error) {
      logError("email-outbox", error);
    }
  });
}
