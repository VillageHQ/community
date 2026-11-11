import "server-only";

import { and, count, desc, eq, gte, inArray, isNotNull } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import type { Environment } from "../../platform/environment.ts";
import { readBranding } from "../../platform/branding/branding.ts";
import { DEMO_EMAIL_NOTE, isDemoMode } from "../../platform/demo/mode.ts";
import { readParentDomain } from "../../platform/email/dns-check.ts";
import { composeSenderAddress, readMailDomain, readMailReplyDomain, readMailSettings, splitFromAddress, type MailSettings } from "../../platform/email/mail-settings.ts";
import { OUTBOX_STATUSES } from "../../platform/email/outbox.ts";
import { readResendConfig, type ResendConfig } from "../../platform/email/resend.ts";
import { readResendWebhookSecret } from "../../platform/email/resend-webhook.ts";
import { emailOutbox, emailSuppression } from "../../platform/email/schema.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { API_ROUTES } from "../../platform/http/routes.ts";
import { weeklyEmailAction } from "../../platform/weekly-email/schema.ts";
import { readReplyDomain } from "../../platform/weekly-email/tokens.ts";

// Set up › Mail and Settings' mail checklist: what the app knows about its mail, read once.
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RECENT_SENDS = 50;
export const MAIL_LOG_SIZE = 50;
// Founderhall's fallback when no domain is known yet.
const PLACEHOLDER_DOMAIN = "example.com";

export const MAIL_LOG_STATES = { sent: "sent", failed: "failed", notSent: "not sent", waiting: "waiting" } as const;
export type MailLogState = (typeof MAIL_LOG_STATES)[keyof typeof MAIL_LOG_STATES];

type OutboxRow = { status: string; lastError: string | null };

// In the demo an email is kept in the log instead of going out; the screens treat it as sent, as the rest of the
// demo does (outbox-sender's sendQueuedEmailNow).
function readLogState({ status, lastError }: OutboxRow, isDemo: boolean): MailLogState {
  if (status === OUTBOX_STATUSES.sent) return MAIL_LOG_STATES.sent;
  if (status === OUTBOX_STATUSES.failed) return MAIL_LOG_STATES.failed;
  if (status === OUTBOX_STATUSES.skipped) return isDemo && lastError === DEMO_EMAIL_NOTE ? MAIL_LOG_STATES.sent : MAIL_LOG_STATES.notSent;
  return MAIL_LOG_STATES.waiting;
}

export type MailOverview = Awaited<ReturnType<typeof readMailOverview>>;

function readMailService(config: ResendConfig | null) {
  if (!config) return null;
  try {
    return new URL(config.apiUrl).host;
  } catch {
    return config.apiUrl;
  }
}

export async function readMailOverview(database: Database, environment: Environment, now = new Date()) {
  const isDemo = isDemoMode(environment);
  const config = readResendConfig(environment);
  const [settings, branding] = await Promise.all([readMailSettings(database), readBranding(database)]);
  const senderAddress = config ? composeSenderAddress(config.fromAddress, settings, branding.name) : null;
  const sendingDomain = readMailDomain(config?.fromAddress ?? null, settings);
  const hostReplyDomain = readReplyDomain(environment);
  const replyDomain = readMailReplyDomain(sendingDomain, hostReplyDomain, settings, readParentDomain);
  const senderEmail = senderAddress ? splitFromAddress(senderAddress).address : `hello@${sendingDomain ?? PLACEHOLDER_DOMAIN}`;
  const since = new Date(now.getTime() - WINDOW_MS);

  const [recent, windowRows, log, suppressions, [replies]] = await Promise.all([
    database
      .select({ status: emailOutbox.status, lastError: emailOutbox.lastError })
      .from(emailOutbox)
      .where(isNotNull(emailOutbox.finishedAt))
      .orderBy(desc(emailOutbox.finishedAt))
      .limit(RECENT_SENDS),
    database
      .select({ status: emailOutbox.status, lastError: emailOutbox.lastError })
      .from(emailOutbox)
      .where(and(gte(emailOutbox.createdAt, since), inArray(emailOutbox.status, [OUTBOX_STATUSES.sent, OUTBOX_STATUSES.failed, OUTBOX_STATUSES.skipped]))),
    database
      .select({ id: emailOutbox.id, kind: emailOutbox.kind, toEmail: emailOutbox.toEmail, status: emailOutbox.status, lastError: emailOutbox.lastError, createdAt: emailOutbox.createdAt, finishedAt: emailOutbox.finishedAt })
      .from(emailOutbox)
      .orderBy(desc(emailOutbox.createdAt))
      .limit(MAIL_LOG_SIZE),
    database.select().from(emailSuppression).orderBy(desc(emailSuppression.createdAt)),
    database.select({ value: count() }).from(weeklyEmailAction).where(and(eq(weeklyEmailAction.via, "reply"), gte(weeklyEmailAction.createdAt, since))),
  ]);

  const recentStates = recent.map((row) => readLogState(row, isDemo));
  const windowStates = windowRows.map((row) => readLogState(row, isDemo));
  const tally = (states: MailLogState[], state: MailLogState) => states.filter((candidate) => candidate === state).length;

  return {
    communityName: branding.name,
    isMailOn: config !== null,
    mailService: readMailService(config),
    settings: settings satisfies MailSettings,
    senderEmail,
    sendingDomain,
    replyDomain: replyDomain ?? PLACEHOLDER_DOMAIN,
    isDomainSet: Boolean(settings.domain),
    inbound: {
      isSet: Boolean(hostReplyDomain && readResendWebhookSecret(environment)),
      address: `${resolveAppUrl(environment)}${API_ROUTES.resendWebhook}`,
    },
    recentSends: { sent: tally(recentStates, MAIL_LOG_STATES.sent), failed: tally(recentStates, MAIL_LOG_STATES.failed) },
    lastThirtyDays: {
      sent: tally(windowStates, MAIL_LOG_STATES.sent),
      failed: tally(windowStates, MAIL_LOG_STATES.failed),
      notSent: tally(windowStates, MAIL_LOG_STATES.notSent),
      repliesIn: replies?.value ?? 0,
    },
    log: log.map(({ id, kind, toEmail, createdAt, finishedAt, ...row }) => ({ id, kind, toEmail, state: readLogState(row, isDemo), at: finishedAt ?? createdAt })),
    suppressions,
  };
}
