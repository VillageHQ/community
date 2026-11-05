import "server-only";

import { eq, inArray, or, sql } from "drizzle-orm";

import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../../platform/settings/schema.ts";
import { DAILY_LOOKUP_LIMITS, dailyLimitBodySchema } from "../admin/admin-api.ts";

export type VillageKeys = { publicKey: string; secretKey: string };
export type VillageGroup = { id: string; inviteLink: string };

async function readSettings(database: Database, keys: string[]) {
  const settings = await database
    .select({ key: instanceSettings.key, value: instanceSettings.value })
    .from(instanceSettings)
    .where(inArray(instanceSettings.key, keys));
  return new Map(settings.map(({ key, value }) => [key, value]));
}

async function saveSettings(database: DatabaseOrTransaction, settings: Record<string, string>) {
  await database
    .insert(instanceSettings)
    .values(Object.entries(settings).map(([key, value]) => ({ key, value })))
    .onConflictDoUpdate({
      target: instanceSettings.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });
}

export async function readVillageKeys(database: Database): Promise<VillageKeys | null> {
  const settings = await readSettings(database, [
    INSTANCE_SETTING_KEYS.villagePublicKey,
    INSTANCE_SETTING_KEYS.villageSecretKey,
  ]);
  const publicKey = settings.get(INSTANCE_SETTING_KEYS.villagePublicKey);
  const secretKey = settings.get(INSTANCE_SETTING_KEYS.villageSecretKey);
  if (!publicKey || !secretKey) return null;
  return { publicKey, secretKey };
}

export async function saveVillageKeys(database: DatabaseOrTransaction, keys: VillageKeys) {
  await saveSettings(database, {
    [INSTANCE_SETTING_KEYS.villagePublicKey]: keys.publicKey,
    [INSTANCE_SETTING_KEYS.villageSecretKey]: keys.secretKey,
  });
}

export async function readConfirmedVillageDomain(database: Database) {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.villageDomainConfirmed]);
  return settings.get(INSTANCE_SETTING_KEYS.villageDomainConfirmed) ?? null;
}

export async function saveConfirmedVillageDomain(database: DatabaseOrTransaction, domain: string) {
  await saveSettings(database, { [INSTANCE_SETTING_KEYS.villageDomainConfirmed]: domain });
}

export async function readDailyLookupLimit(database: Database) {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.dailyLookupLimit]);
  const limit = dailyLimitBodySchema.shape.limit.safeParse(Number(settings.get(INSTANCE_SETTING_KEYS.dailyLookupLimit)));
  return limit.success ? limit.data : DAILY_LOOKUP_LIMITS.default;
}

export async function saveDailyLookupLimit(database: DatabaseOrTransaction, limit: number) {
  await saveSettings(database, { [INSTANCE_SETTING_KEYS.dailyLookupLimit]: String(limit) });
}

export async function readVillageOutOfCreditsAt(database: Database) {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.villageOutOfCreditsAt]);
  return settings.get(INSTANCE_SETTING_KEYS.villageOutOfCreditsAt) ?? null;
}

export async function recordVillageOutOfCredits(database: Database) {
  await saveSettings(database, { [INSTANCE_SETTING_KEYS.villageOutOfCreditsAt]: new Date().toISOString() });
}

export async function clearVillageOutOfCredits(database: Database) {
  await database.delete(instanceSettings).where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.villageOutOfCreditsAt));
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
