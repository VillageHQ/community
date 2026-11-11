import "server-only";

import { eq } from "drizzle-orm";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { emailSuppression } from "../../platform/email/schema.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { ADMIN_ERROR_CODES } from "./contract.ts";

const NOT_FOUND_STATUS = 404;

// Takes an address off the do-not-send list, so optional email reaches it again. Audited.
export async function removeFromDoNotSend({ database, member }: RequestContext, email: string) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    const removed = await transaction.delete(emailSuppression).where(eq(emailSuppression.email, email)).returning({ email: emailSuppression.email });
    if (removed.length === 0) throw new RequestError(NOT_FOUND_STATUS, ADMIN_ERROR_CODES.notOnDoNotSend, "That address isn't on the do-not-send list.");
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.emailUnsuppressed, detail: email });
  });
}
