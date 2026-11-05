import "server-only";

import { eq, or } from "drizzle-orm";

import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../../platform/settings/schema.ts";
import { readSettings, saveSettings } from "../../platform/settings/store.ts";

export type VillageGroup = { id: string; inviteLink: string };

export async function readConfirmedVillageDomain(database: Database) {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.villageDomainConfirmed]);
  return settings.get(INSTANCE_SETTING_KEYS.villageDomainConfirmed) ?? null;
}

export async function saveConfirmedVillageDomain(database: DatabaseOrTransaction, domain: string) {
  await saveSettings(database, { [INSTANCE_SETTING_KEYS.villageDomainConfirmed]: domain });
}

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
