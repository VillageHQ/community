import "server-only";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { parseInvitesCsv } from "./contract-bulk-invites.ts";
import { FILL_IN_BASES } from "./contract-fill-in.ts";
import { IMPORT_SHOWN_LINES, IMPORT_SHOWN_PEOPLE, type ImportBasis, type ImportResult } from "./contract-import.ts";
import { createBulkInvites } from "./service-bulk-invites.ts";
import { readFillInSettings, saveFillInSettings } from "./service-fill-in.ts";

const IMPORT_AUDIT_DETAIL = "From a CSV import";

// Community keeps one fill-in basis for the whole community. The import's answer becomes it when it differs,
// in the admin's audited transaction, as Settings › Village would save it.
async function saveImportBasis({ database, member }: RequestContext, chosen: ImportBasis) {
  const current = await readFillInSettings(database);
  const termsDate = chosen.basis === FILL_IN_BASES.terms ? chosen.termsDate : null;
  if (current.basis === chosen.basis && current.termsDate === termsDate) return;
  await withAdminTransaction(database, member.id, async (transaction) => {
    await saveFillInSettings(transaction, chosen);
    const detail = chosen.basis === FILL_IN_BASES.terms ? `terms:${chosen.termsDate}` : chosen.basis;
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.fillInBasisChanged, detail });
  });
}

// Each person becomes an invited member with Community's single-use 14-day invite; members and open invites are
// skipped. "Email each person their invite now" off: no email is queued, and the invites wait on Sign-in links.
export async function importMembers(context: RequestContext, csv: string, { sendEmail, basis }: { sendEmail: boolean; basis: ImportBasis }): Promise<ImportResult> {
  const parsed = parseInvitesCsv(csv);
  await saveImportBasis(context, basis);
  const result = await createBulkInvites(context, parsed, { sendEmail, auditDetail: IMPORT_AUDIT_DETAIL });
  const skippedEmails = new Set(result.skipped.map(({ email }) => email));
  const imported = parsed.people.filter(({ email }) => !skippedEmails.has(email));
  const notImported = [...result.problems.map(({ line, why }) => ({ line, why })), ...result.skipped.map(({ line, why }) => ({ line, why }))].sort(
    (first, second) => first.line - second.line,
  );
  return {
    importedCount: result.invitedCount + result.renewedCount,
    imported: imported.slice(0, IMPORT_SHOWN_PEOPLE).map(({ email, name, company, cohort }) => ({ email, name, company, cohort })),
    skippedCount: result.skipped.length,
    problemCount: result.problems.length,
    rowCount: parsed.people.length + parsed.skipped.length,
    notImported: notImported.slice(0, IMPORT_SHOWN_LINES),
    notImportedCount: notImported.length,
    isEmailing: sendEmail && readResendConfig(context.environment) !== null && result.invitedCount + result.renewedCount > 0,
  };
}
