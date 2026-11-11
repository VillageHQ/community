import "server-only";

import { and, eq, gte, isNull, lte } from "drizzle-orm";

import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { readEmailBranding } from "../../platform/email/outbox.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { CONNECTOR_REMINDER_AFTER_DAYS, EXPIRY_EMAIL_WINDOW_DAYS, INTRO_STATES } from "./contract.ts";
import { INTRO_EMAIL_EVENTS, queueIntroEmail, type IntroEmailEvent } from "./email.ts";
import { isActiveParticipant, isLiveBetweenMembers } from "./reads-consent.ts";
import { introRequest } from "./schema.ts";

const MILLISECONDS_PER_DAY = 86_400_000;
const BATCH_SIZE = 20;

function daysBefore(now: Date, days: number) {
  return new Date(now.getTime() - days * MILLISECONDS_PER_DAY);
}

// Still waiting on the connector 4 days after the ask, and never reminded. Withheld or blocked asks never reached
// them, so they get no reminder either.
function isConnectorReminderDue(connection: DatabaseOrTransaction, now: Date) {
  return and(
    eq(introRequest.state, INTRO_STATES.requested),
    isLiveBetweenMembers(connection, now),
    isNull(introRequest.connectorReminderAt),
    lte(introRequest.createdAt, daysBefore(now, CONNECTOR_REMINDER_AFTER_DAYS)),
  );
}

// Closed by its deadline lately, the asker is still here, and never told.
function isExpiryEmailDue(connection: DatabaseOrTransaction, now: Date) {
  return and(
    eq(introRequest.state, INTRO_STATES.expired),
    isNull(introRequest.expiryEmailAt),
    lte(introRequest.expiresAt, now),
    isActiveParticipant(connection, introRequest.requesterId, now),
    // A row closed long ago (or before this email existed) is left alone.
    gte(introRequest.closedAt, daysBefore(now, EXPIRY_EMAIL_WINDOW_DAYS)),
  );
}

const QUIET_INTRO_EMAILS = {
  connectorReminder: { event: INTRO_EMAIL_EVENTS.connectorReminder, key: "connectorReminderAt", isDue: isConnectorReminderDue },
  expired: { event: INTRO_EMAIL_EVENTS.expired, key: "expiryEmailAt", isDue: isExpiryEmailDue },
} as const;

type QuietIntroEmail = {
  event: IntroEmailEvent;
  key: "connectorReminderAt" | "expiryEmailAt";
  isDue: (connection: DatabaseOrTransaction, now: Date) => ReturnType<typeof and>;
};

// The claim and the queued email commit together, so a crash leaves both or neither. The claim is one conditional
// UPDATE, so two runs at once can't both send, and a claimed email is never claimed again: one at most, ever.
// The outbox job sends what this queues.
async function sendQuietIntroEmails(database: Database, environment: Environment, kind: QuietIntroEmail, now: Date) {
  if (!readResendConfig(environment)) return 0;
  const branding = await readEmailBranding(database, environment);
  if (!branding) return 0;
  const due = await database.select({ id: introRequest.id }).from(introRequest).where(kind.isDue(database, now)).limit(BATCH_SIZE);
  let sent = 0;
  for (const { id } of due) {
    try {
      const isQueued = await database.transaction(async (transaction) => {
        const [claimed] = await transaction
          .update(introRequest)
          .set({ [kind.key]: now })
          .where(and(eq(introRequest.id, id), kind.isDue(transaction, now)))
          .returning({ id: introRequest.id });
        if (!claimed) return false;
        return (await queueIntroEmail(transaction, environment, branding, id, kind.event)) !== null;
      });
      if (isQueued) sent += 1;
    } catch (error) {
      logError(`intro-${kind.event}`, error);
    }
  }
  return sent;
}

// Run by the job runner: one reminder to a connector who hasn't answered after 4 days.
export async function sendDueConnectorReminders(database: Database, environment: Environment, now = new Date()) {
  return { reminded: await sendQuietIntroEmails(database, environment, QUIET_INTRO_EMAILS.connectorReminder, now) };
}

// Run by the job runner after the expiry sweep: one kind email to the asker when an intro closes without an answer.
export async function sendDueExpiryEmails(database: Database, environment: Environment, now = new Date()) {
  return { emailed: await sendQuietIntroEmails(database, environment, QUIET_INTRO_EMAILS.expired, now) };
}
