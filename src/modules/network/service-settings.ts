import "server-only";

import { eq, or } from "drizzle-orm";

import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../../platform/settings/schema.ts";
import { readSettings, saveSettings } from "../../platform/settings/store.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { saveDailyLookupLimit, saveMonthlyCreditCap } from "../../platform/village/settings.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";

export type VillageGroup = { id: string; inviteLink: string };

export async function readVillageGroup(database: Database): Promise<VillageGroup | null> {
  const settings = await readSettings(database, [
    INSTANCE_SETTING_KEYS.villageGroupId,
    INSTANCE_SETTING_KEYS.villageGroupInviteLink,
  ]);
  const id = settings.get(INSTANCE_SETTING_KEYS.villageGroupId);
  const inviteLink = settings.get(INSTANCE_SETTING_KEYS.villageGroupInviteLink);
  if (!id || !inviteLink) return null;
  return { id, inviteLink };
}

export async function saveVillageGroup(database: DatabaseOrTransaction, group: VillageGroup) {
  await saveSettings(database, {
    [INSTANCE_SETTING_KEYS.villageGroupId]: group.id,
    [INSTANCE_SETTING_KEYS.villageGroupInviteLink]: group.inviteLink,
  });
}

export async function deleteVillageGroup(database: Database) {
  await database
    .delete(instanceSettings)
    .where(
      or(
        eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageGroupId),
        eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageGroupInviteLink),
      ),
    );
}

export function setDailyLookupLimit({ database, member }: RequestContext, limit: number) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveDailyLookupLimit(transaction, limit);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.dailyLimitChanged, detail: String(limit) });
  });
}

export function setMonthlyCreditCap({ database, member }: RequestContext, cap: number) {
  return withAdminTransaction(database, member.id, async (transaction) => {
    await saveMonthlyCreditCap(transaction, cap);
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.monthlyCapChanged, detail: String(cap) });
  });
}
