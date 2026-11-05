import "server-only";

import { and, eq } from "drizzle-orm";

import type { Database, DatabaseOrTransaction } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { logError } from "../observability/route-logging.ts";
import { isSealedValue, openSealedSecret, sealSecret } from "../secrets/sealed.ts";
import { readSetupToken } from "../secrets/setup-token.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema.ts";
import { DAILY_LOOKUP_LIMITS, dailyLimitBodySchema } from "./contract.ts";
import { readSettings, saveSettings } from "../settings/store.ts";

export type VillageKeys = { publicKey: string; secretKey: string };

export const VILLAGE_KEY_STATUSES = { missing: "missing", sealed: "sealed", plain: "plain", unreadable: "unreadable" } as const;

export type VillageKeyStatus = (typeof VILLAGE_KEY_STATUSES)[keyof typeof VILLAGE_KEY_STATUSES];

type VillageKeyState = { status: VillageKeyStatus; publicKey: string | null; keys: VillageKeys | null };

const SECRET_KEY_LABEL = INSTANCE_SETTING_KEYS.villageSecretKey;

const loggedUnreadableValues = new Set<string>();

function logUnreadableOnce(sealedValue: string) {
  if (loggedUnreadableValues.has(sealedValue)) return;
  loggedUnreadableValues.add(sealedValue);
  logError("village-keys", new Error("The Village secret key can't be opened with this SETUP_TOKEN. An admin needs to paste the keys again."));
}

// Only replaces the exact value it read, so it can't overwrite keys another instance just saved.
async function sealStoredPlaintext(database: Database, plaintext: string, token: string) {
  try {
    await database
      .update(instanceSettings)
      .set({ value: await sealSecret(plaintext, token, SECRET_KEY_LABEL) })
      .where(and(eq(instanceSettings.key, SECRET_KEY_LABEL), eq(instanceSettings.value, plaintext)));
  } catch (error) {
    logError("village-keys", error);
  }
}

export async function readVillageKeyState(database: Database, environment: Environment = process.env): Promise<VillageKeyState> {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.villagePublicKey, SECRET_KEY_LABEL]);
  const publicKey = settings.get(INSTANCE_SETTING_KEYS.villagePublicKey) ?? null;
  const storedSecret = settings.get(SECRET_KEY_LABEL);
  if (!publicKey || !storedSecret) return { status: VILLAGE_KEY_STATUSES.missing, publicKey, keys: null };

  const token = readSetupToken(environment);
  if (!isSealedValue(storedSecret)) {
    const keys = { publicKey, secretKey: storedSecret };
    if (!token) return { status: VILLAGE_KEY_STATUSES.plain, publicKey, keys };
    await sealStoredPlaintext(database, storedSecret, token);
    return { status: VILLAGE_KEY_STATUSES.sealed, publicKey, keys };
  }

  const secretKey = token ? await openSealedSecret(storedSecret, token, SECRET_KEY_LABEL) : null;
  if (secretKey === null) {
    logUnreadableOnce(storedSecret);
    return { status: VILLAGE_KEY_STATUSES.unreadable, publicKey, keys: null };
  }
  return { status: VILLAGE_KEY_STATUSES.sealed, publicKey, keys: { publicKey, secretKey } };
}

export async function readVillageKeys(database: Database, environment: Environment = process.env): Promise<VillageKeys | null> {
  return (await readVillageKeyState(database, environment)).keys;
}

export async function saveVillageKeys(database: DatabaseOrTransaction, keys: VillageKeys, environment: Environment = process.env) {
  const token = readSetupToken(environment);
  await saveSettings(database, {
    [INSTANCE_SETTING_KEYS.villagePublicKey]: keys.publicKey,
    [SECRET_KEY_LABEL]: token ? await sealSecret(keys.secretKey, token, SECRET_KEY_LABEL) : keys.secretKey,
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
