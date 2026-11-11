import "server-only";

import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { INTRO_STATES, OUTCOME_REMINDER_AFTER_DAYS } from "./contract.ts";
import { deliverIntroEmail, INTRO_EMAIL_EVENTS } from "./email.ts";
import { introRequest } from "./schema.ts";
import { outcomePromptedFromSql, outcomeWindowFromSql } from "./reads-outcome-days.ts";

const MILLISECONDS_PER_DAY = 86_400_000;
const BATCH_SIZE = 20;
const MINIMUM_GAP_MS = 60_000;

declare global {
  // Next can bundle this file more than once, so the last run time lives on globalThis.
  var communityOutcomeEmailsRanAt: number | undefined;
}

function daysBefore(now: Date, days: number) {
  return new Date(now.getTime() - days * MILLISECONDS_PER_DAY);
}

function selectActiveMemberIds(database: Database, now: Date) {
  return database.select({ id: user.id }).from(user).where(isActiveMember(now));
}

// Completed intros whose requester hasn't answered "did it help?" yet, inside the window where asking still makes sense.
function isAwaitingOutcome(database: Database, now: Date) {
  return and(
    eq(introRequest.state, INTRO_STATES.completed),
    isNull(introRequest.outcome),
    eq(introRequest.isWithheld, false),
    gt(introRequest.closedAt, outcomeWindowFromSql(now)),
    inArray(introRequest.requesterId, selectActiveMemberIds(database, now)),
  );
}

const OUTCOME_EMAIL_KINDS = {
  first: { event: INTRO_EMAIL_EVENTS.outcomeAsked, column: introRequest.outcomeEmailAt, key: "outcomeEmailAt" },
  reminder: { event: INTRO_EMAIL_EVENTS.outcomeReminder, column: introRequest.outcomeReminderAt, key: "outcomeReminderAt" },
} as const;

type OutcomeEmailKind = (typeof OUTCOME_EMAIL_KINDS)[keyof typeof OUTCOME_EMAIL_KINDS];

function isDue(kind: OutcomeEmailKind, now: Date) {
  if (kind === OUTCOME_EMAIL_KINDS.first) return lte(introRequest.closedAt, outcomePromptedFromSql(now));
  return lte(introRequest.outcomeEmailAt, daysBefore(now, OUTCOME_REMINDER_AFTER_DAYS));
}

// Claim first with one conditional UPDATE, so two servers or two tabs can't both send. A failed send gives the claim
// back, guarded by the claim time, so the next run tries again.
async function sendOutcomeEmails(database: Database, environment: Environment, kind: OutcomeEmailKind, now: Date) {
  const due = and(isAwaitingOutcome(database, now), isNull(kind.column), isDue(kind, now));
  const batch = database.select({ id: introRequest.id }).from(introRequest).where(due).limit(BATCH_SIZE);
  const claimed = await database
    .update(introRequest)
    .set({ [kind.key]: now })
    .where(and(inArray(introRequest.id, batch), due))
    .returning();
  for (const intro of claimed) {
    const [requester] = await database.select({ name: user.name }).from(user).where(eq(user.id, intro.requesterId));
    const isSent = await deliverIntroEmail(database, environment, {
      introId: intro.id,
      event: kind.event,
      requesterId: intro.requesterId,
      introducerId: intro.introducerId,
      requesterName: requester?.name ?? "",
      introducerName: intro.introducerName,
      targetName: intro.targetName,
    });
    if (!isSent) {
      await database
        .update(introRequest)
        .set({ [kind.key]: null })
        .where(and(eq(introRequest.id, intro.id), eq(kind.column, now)));
    }
  }
}

// Sends the "did it help?" email when it's due, and one reminder 3 days later if there's still no answer.
// TODO(job runner): this runs from the read-time path (the intros badge and board) because the app has no scheduler
// yet. When the shared job runner lands, call sendDueOutcomeEmails from it on a timer and drop the read-time calls.
export async function sendDueOutcomeEmails(database: Database, environment: Environment, now = new Date()) {
  if (!readResendConfig(environment)) return;
  const lastRun = globalThis.communityOutcomeEmailsRanAt ?? 0;
  if (now.getTime() - lastRun < MINIMUM_GAP_MS) return;
  globalThis.communityOutcomeEmailsRanAt = now.getTime();
  try {
    await sendOutcomeEmails(database, environment, OUTCOME_EMAIL_KINDS.first, now);
    await sendOutcomeEmails(database, environment, OUTCOME_EMAIL_KINDS.reminder, now);
  } catch (error) {
    logError("intro-outcome-email", error);
  }
}

export function resetOutcomeEmailGap() {
  globalThis.communityOutcomeEmailsRanAt = undefined;
}
