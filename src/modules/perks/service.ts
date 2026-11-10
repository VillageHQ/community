import "server-only";

import { eq } from "drizzle-orm";

import { AUDIT_ACTIONS } from "@/platform/audit/actions";
import { withAdminTransaction } from "@/platform/audit/admin-transaction";
import { recordAdminAction } from "@/platform/audit/record";
import type { Database } from "@/platform/database/client";
import type { RequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";
import { instanceSettings } from "@/platform/settings/schema";
import { readSettings, saveSettings } from "@/platform/settings/store";

import { parsePerksEmbed, PERKS_EMBED_SETTING, PERKS_ERROR_CODES, readBuiltfirstUrl } from "./contract";

const UNPROCESSABLE_STATUS = 422;

// The saved marketplace address, checked again on the way out, or null.
export async function readPerksUrl(database: Database) {
  const settings = await readSettings(database, [PERKS_EMBED_SETTING]);
  const saved = settings.get(PERKS_EMBED_SETTING);
  return saved ? readBuiltfirstUrl(saved) : null;
}

export async function savePerksEmbed({ database, member }: RequestContext, code: string) {
  const parsed = parsePerksEmbed(code);
  if ("error" in parsed) throw new RequestError(UNPROCESSABLE_STATUS, PERKS_ERROR_CODES.refused, parsed.error);
  await withAdminTransaction(database, member.id, async (transaction) => {
    await saveSettings(transaction, { [PERKS_EMBED_SETTING]: parsed.url });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.perksSaved });
  });
  return parsed.url;
}

export async function removePerksEmbed({ database, member }: RequestContext) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    await transaction.delete(instanceSettings).where(eq(instanceSettings.key, PERKS_EMBED_SETTING));
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.perksRemoved });
  });
}
