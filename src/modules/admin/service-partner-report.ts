import "server-only";

import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import type { Database } from "../../platform/database/client.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail } from "../../platform/email/outbox.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import { emailSuppression } from "../../platform/email/schema.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { recordFailedAttempt } from "../../platform/rate-limit/attempt-rate-limit.ts";
import { INSTANCE_SETTING_KEYS } from "../../platform/settings/schema.ts";
import { saveSettings } from "../../platform/settings/store.ts";
import type { PartnerReportSendBody, PartnerReportSent } from "./contract-partner-report.ts";
import type { ConsolePeriodParam } from "./console-periods.ts";
import { joinRecipients, readPartnerReportSettings } from "./reads-partner-report.ts";
import { readReportStats } from "./reads-report-stats.ts";
import { renderReportEmailHtml, renderReportEmailText } from "./report-stats.ts";

const CONFLICT_STATUS = 409;
const TOO_MANY_REQUESTS_STATUS = 429;
const SENDS_PER_MINUTE = 3;

export const PARTNER_REPORT_ERROR_CODES = { emailOff: "partner_report_email_off", tooFast: "partner_report_too_fast" } as const;

// The email partners get (Founderhall's words): the report's title as the subject, the report as plain text.
export async function renderPartnerReportEmailFor(database: Database, { note, period }: { note: string | null; period: ConsolePeriodParam }) {
  const report = await readReportStats(database, period);
  const text = renderReportEmailText(report, note);
  return { subject: report.title, text, html: renderReportEmailHtml(text) };
}

// The exact email partners get, for the preview. It reads the same report the send does.
export async function previewPartnerReport({ database }: RequestContext, { note, period }: { note: string | null; period: ConsolePeriodParam }) {
  return renderPartnerReportEmailFor(database, { note, period });
}

async function readSuppressed(database: Database, recipients: readonly string[]) {
  const rows = await database.select({ email: emailSuppression.email }).from(emailSuppression).where(inArray(emailSuppression.email, [...recipients]));
  return new Set(rows.map(({ email }) => email));
}

// One outbox email per address, all queued in one transaction with the audit entry and the remembered addresses.
// An address that bounced or complained before is skipped and named back to the admin.
export async function sendPartnerReport({ database, environment, member }: RequestContext, { recipients, note, period }: PartnerReportSendBody): Promise<PartnerReportSent> {
  if (!readResendConfig(environment)) {
    throw new RequestError(CONFLICT_STATUS, PARTNER_REPORT_ERROR_CODES.emailOff, "Email is off on this site, so nothing was sent. Download the CSV or print the page instead.");
  }
  if ((await recordFailedAttempt(database, `partner-report-send:${member.id}`, SENDS_PER_MINUTE)).isLimited) {
    throw new RequestError(TOO_MANY_REQUESTS_STATUS, PARTNER_REPORT_ERROR_CODES.tooFast, "You just sent this. Wait a minute before sending it again.");
  }

  const [email, suppressed] = await Promise.all([renderPartnerReportEmailFor(database, { note, period }), readSuppressed(database, recipients)]);
  const sendable = recipients.filter((address) => !suppressed.has(address));
  const sendId = randomUUID();

  return withAdminTransaction(database, member.id, async (transaction) => {
    let queued = 0;
    for (const to of sendable) {
      const id = await queueEmail(transaction, environment, { kind: EMAIL_KINDS.partnerReport, to, memberId: null, ...email, dedupeKey: `partner-report:${sendId}:${to}` });
      if (id) queued += 1;
    }
    const { sharedAt } = await readPartnerReportSettings(database);
    await saveSettings(transaction, {
      [INSTANCE_SETTING_KEYS.partnerReportRecipients]: joinRecipients(recipients),
      ...(sharedAt ? {} : { [INSTANCE_SETTING_KEYS.partnerReportSharedAt]: new Date().toISOString() }),
    });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.partnerReportSent, detail: queued === 1 ? "1 address" : `${queued} addresses` });
    return { queued, skipped: recipients.filter((address) => suppressed.has(address)) };
  });
}

// For a community that shares the report another way (print, CSV): it finishes the last setup step.
export async function markPartnerReportShared({ database, member }: RequestContext) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveSettings(transaction, { [INSTANCE_SETTING_KEYS.partnerReportSharedAt]: new Date().toISOString() });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.partnerReportMarkedShared });
    return { isShared: true };
  });
}
