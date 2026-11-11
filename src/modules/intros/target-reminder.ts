import "server-only";

import { and, eq, isNotNull, isNull, lte } from "drizzle-orm";

import { readBranding } from "../../platform/branding/branding.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail } from "../../platform/email/outbox.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { TARGET_REMINDER_AFTER_DAYS } from "./contract.ts";
import { renderTargetReminderEmail } from "./email-target.ts";
import { readWhyTheyWrote } from "./copy.ts";
import { memberProfile } from "../members/schema.ts";
import { shownCompanyColumn } from "../members/reads-pictures.ts";
import { isTargetOptedOut } from "./opt-out.ts";
import { isAwaitingTarget } from "./reads-consent.ts";
import { introRequest } from "./schema.ts";
import { issueConsent, saveConsentLink } from "./service-consent.ts";

const MILLISECONDS_PER_DAY = 86_400_000;
const BATCH_SIZE = 20;

// Still waiting on the person asked, emailed by the app at least 4 days ago, and never reminded. A person whose link
// the connector shared by hand has no address here, so gets no reminder.
function isReminderDue(database: Database, now: Date) {
  return and(
    isAwaitingTarget(database, now),
    isNotNull(introRequest.targetEmail),
    isNull(introRequest.targetReminderAt),
    lte(introRequest.consentEmailAt, new Date(now.getTime() - TARGET_REMINDER_AFTER_DAYS * MILLISECONDS_PER_DAY)),
  );
}

// The claim, the new link and the queued email commit together, so a crash leaves either all three or none. The claim
// is one conditional UPDATE, so two runs at once can't both remind. A claimed reminder is never claimed again, even
// when it is not sent (the person asked to stop all asks): one reminder at most, ever.
async function remindOne(database: Database, environment: Environment, introId: string, now: Date) {
  const [requester, branding] = await Promise.all([
    database
      .select({ name: user.name, title: memberProfile.title, company: shownCompanyColumn(introRequest.requesterId) })
      .from(introRequest)
      .innerJoin(user, eq(user.id, introRequest.requesterId))
      .leftJoin(memberProfile, eq(memberProfile.userId, introRequest.requesterId))
      .where(eq(introRequest.id, introId)),
    readBranding(database),
  ]);
  return database.transaction(async (transaction) => {
    const [claimed] = await transaction
      .update(introRequest)
      .set({ targetReminderAt: now })
      .where(and(eq(introRequest.id, introId), isReminderDue(database, now)))
      .returning();
    if (!claimed?.targetEmail) return false;
    if (await isTargetOptedOut(database, environment, claimed.targetLinkedinSlug)) return false;

    const { tokenHash, consentIssue } = issueConsent(environment);
    await saveConsentLink(transaction, claimed.id, tokenHash);
    const asker = requester[0];
    const facts = {
      requesterName: asker?.name ?? "",
      requesterHeadline: [asker?.title, asker?.company].filter(Boolean).join(", ") || null,
      introducerName: claimed.introducerName,
      targetName: claimed.targetName,
      communityName: branding.name,
      note: readWhyTheyWrote(claimed.note, claimed.introducerName, claimed.targetName),
    };
    const queuedId = await queueEmail(transaction, environment, {
      kind: EMAIL_KINDS.introTargetReminder,
      to: claimed.targetEmail,
      memberId: null,
      dedupeKey: `intro-target-reminder-${claimed.id}`,
      ...renderTargetReminderEmail(facts, environment, consentIssue.token),
    });
    return queuedId !== null;
  });
}

// Run by the job runner. The outbox job sends what this queues.
export async function sendDueTargetReminders(database: Database, environment: Environment, now = new Date()) {
  if (!readResendConfig(environment)) return { reminded: 0 };
  const due = await database.select({ id: introRequest.id }).from(introRequest).where(isReminderDue(database, now)).limit(BATCH_SIZE);
  let reminded = 0;
  for (const { id } of due) {
    try {
      if (await remindOne(database, environment, id, now)) reminded += 1;
    } catch (error) {
      logError("intro-target-reminder", error);
    }
  }
  return { reminded };
}
