import "server-only";

import { eq } from "drizzle-orm";

import type { Database, DatabaseOrTransaction } from "../database/client.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema.ts";
import { DAILY_LOOKUP_LIMITS, dailyLimitBodySchema } from "./contract.ts";
import { readSettings, saveSettings } from "../settings/store.ts";

export type VillageKeys = { publicKey: string; secretKey: string };

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
