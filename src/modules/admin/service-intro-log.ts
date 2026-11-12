import "server-only";

import { recordAdminAction } from "../../platform/audit/record.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { saveSettings } from "../../platform/settings/store.ts";
import { OUTCOME_DAYS_SETTING } from "../intros/contract-outcome-days.ts";

// The Intro log's "The outcome question": how many days after each intro the member who asked is asked if it helped.
export async function saveOutcomeDays({ database, member }: RequestContext, outcomeDays: number) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    await saveSettings(transaction, { [OUTCOME_DAYS_SETTING]: String(outcomeDays) });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.introOutcomeDaysChanged, detail: String(outcomeDays) });
  });
}
