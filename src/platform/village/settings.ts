import "server-only";

import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { Database, DatabaseOrTransaction } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { logError } from "../observability/route-logging.ts";
import { isPreview } from "../database/migration-plan.ts";
import { RequestError } from "../http/request-error.ts";
import { isReadableSealedValue, looksSealed, openSealedSecret, OPEN_OUTCOMES, sealSecret, type OpenResult } from "../secrets/sealed.ts";
import { readSetupToken } from "../secrets/setup-token.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema.ts";
import { DAILY_LOOKUP_LIMITS, dailyLimitBodySchema, MONTHLY_CREDIT_CAPS, monthlyCapBodySchema, KEY_STORAGE, VILLAGE_KEY_STATUSES, type VillageKeyStatus } from "./contract.ts";
import { VILLAGE_ERROR_CODES } from "./error-codes.ts";
import { readSettings, saveSettings } from "../settings/store.ts";

export type VillageKeys = { publicKey: string; secretKey: string };

type VillageKeyState = { status: VillageKeyStatus; publicKey: string | null; keys: VillageKeys | null };

type SealingState = { attempts: Map<string, Promise<boolean>>; retryAfterMs: Map<string, number>; loggedProblems: Set<string> };

declare global {
  // Next can bundle this file more than once. A process makes one attempt at a time and logs each problem once.
  var communityVillageKeySealing: SealingState | undefined;
}

const SECRET_KEY_LABEL = INSTANCE_SETTING_KEYS.villageSecretKey;
const SEAL_RETRY_DELAY_MS = 5 * 60 * 1000;
const UNPROCESSABLE_STATUS = 422;

const STATUS_BY_OUTCOME: Record<UnopenedResult["outcome"], VillageKeyStatus> = {
  [OPEN_OUTCOMES.wrongToken]: VILLAGE_KEY_STATUSES.tokenDifferent,
  [OPEN_OUTCOMES.unsupported]: VILLAGE_KEY_STATUSES.damaged,
  [OPEN_OUTCOMES.derivationFailed]: VILLAGE_KEY_STATUSES.unavailable,
};

const PROBLEM_MESSAGES: Partial<Record<VillageKeyStatus, string>> = {
  [VILLAGE_KEY_STATUSES.tokenMissing]: "The Village secret key is sealed, and this site has no usable SETUP_TOKEN.",
  [VILLAGE_KEY_STATUSES.tokenDifferent]: "The Village secret key can't be opened with this SETUP_TOKEN.",
  [VILLAGE_KEY_STATUSES.damaged]: "The stored Village secret key isn't in a form this version can read.",
  [VILLAGE_KEY_STATUSES.unavailable]: "The key for the Village secret couldn't be derived. It will be tried again.",
};

function readSealingState() {
  globalThis.communityVillageKeySealing ??= { attempts: new Map(), retryAfterMs: new Map(), loggedProblems: new Set() };
  return globalThis.communityVillageKeySealing;
}

function logProblemOnce(status: VillageKeyStatus, storedSecret: string) {
  const { loggedProblems } = readSealingState();
  const problemKey = `${status}:${toDigest(storedSecret)}`;
  const message = PROBLEM_MESSAGES[status];
  if (!message || loggedProblems.has(problemKey)) return;
  loggedProblems.add(problemKey);
  logError("village-keys", new Error(message));
}

function toDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function readStoredSecret(database: Database) {
  const settings = await readSettings(database, [SECRET_KEY_LABEL]);
  return settings.get(SECRET_KEY_LABEL) ?? null;
}

// Only replaces the exact value it read, so it can't overwrite keys another instance just saved.
async function replacePlaintext(database: Database, plaintext: string, token: string) {
  const updated = await database
    .update(instanceSettings)
    .set({ value: await sealSecret(plaintext, token, SECRET_KEY_LABEL) })
    .where(and(eq(instanceSettings.key, SECRET_KEY_LABEL), eq(instanceSettings.value, plaintext)))
    .returning({ key: instanceSettings.key });
  if (updated.length > 0) return true;

  const stored = await readStoredSecret(database);
  return stored !== null && looksSealed(stored);
}

async function attemptSealing(database: Database, plaintext: string, token: string, attemptKey: string) {
  const { retryAfterMs } = readSealingState();
  try {
    const isSealed = await replacePlaintext(database, plaintext, token);
    if (isSealed) retryAfterMs.delete(attemptKey);
    return isSealed;
  } catch (error) {
    logError("village-keys", error);
    retryAfterMs.set(attemptKey, Date.now() + SEAL_RETRY_DELAY_MS);
    return false;
  }
}

// Reports what's stored afterwards. Readers at the same moment share one attempt, and a failure waits before the next.
export function sealStoredPlaintext(database: Database, plaintext: string, token: string) {
  const { attempts, retryAfterMs } = readSealingState();
  const attemptKey = toDigest(plaintext);
  if (Date.now() < (retryAfterMs.get(attemptKey) ?? 0)) return Promise.resolve(false);

  const running = attempts.get(attemptKey);
  if (running) return running;

  const attempt = attemptSealing(database, plaintext, token, attemptKey).finally(() => attempts.delete(attemptKey));
  attempts.set(attemptKey, attempt);
  return attempt;
}

async function readPlaintextState(database: Database, storedSecret: string, publicKey: string, environment: Environment): Promise<VillageKeyState> {
  const keys = { publicKey, secretKey: storedSecret };
  if (isPreview(environment)) return { status: VILLAGE_KEY_STATUSES.preview, publicKey, keys };
  const token = readSetupToken(environment);
  if (!token) return { status: VILLAGE_KEY_STATUSES.plain, publicKey, keys };

  const isSealed = await sealStoredPlaintext(database, storedSecret, token);
  return { status: isSealed ? VILLAGE_KEY_STATUSES.sealed : VILLAGE_KEY_STATUSES.sealFailed, publicKey, keys };
}

type UnopenedResult = Exclude<OpenResult, { outcome: typeof OPEN_OUTCOMES.opened }>;

function readUnopenedStatus(storedSecret: string, result: UnopenedResult | null, environment: Environment) {
  if (!isReadableSealedValue(storedSecret)) return VILLAGE_KEY_STATUSES.damaged;
  if (isPreview(environment)) return VILLAGE_KEY_STATUSES.preview;
  return result ? STATUS_BY_OUTCOME[result.outcome] : VILLAGE_KEY_STATUSES.tokenMissing;
}

async function readSealedState(storedSecret: string, publicKey: string, environment: Environment): Promise<VillageKeyState> {
  const token = readSetupToken(environment);
  const result = token ? await openSealedSecret(storedSecret, token, SECRET_KEY_LABEL) : null;
  if (result?.outcome === OPEN_OUTCOMES.opened) return { status: VILLAGE_KEY_STATUSES.sealed, publicKey, keys: { publicKey, secretKey: result.secret } };

  const status = readUnopenedStatus(storedSecret, result ?? null, environment);
  logProblemOnce(status, storedSecret);
  return { status, publicKey, keys: null };
}

export async function readVillageKeyState(database: Database, environment: Environment = process.env): Promise<VillageKeyState> {
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.villagePublicKey, SECRET_KEY_LABEL]);
  const publicKey = settings.get(INSTANCE_SETTING_KEYS.villagePublicKey) ?? null;
  const storedSecret = settings.get(SECRET_KEY_LABEL);
  if (!publicKey || !storedSecret) return { status: VILLAGE_KEY_STATUSES.missing, publicKey, keys: null };

  return looksSealed(storedSecret) ? readSealedState(storedSecret, publicKey, environment) : readPlaintextState(database, storedSecret, publicKey, environment);
}

export async function readVillageKeys(database: Database, environment: Environment = process.env): Promise<VillageKeys | null> {
  return (await readVillageKeyState(database, environment)).keys;
}

// Runs after migrations, so a community with Network off still gets its secret sealed. It must never stop the server.
export async function sealVillageSecretOnBoot(database: Database, environment: Environment = process.env) {
  try {
    await readVillageKeyState(database, environment);
  } catch (error) {
    logError("village-keys", error);
  }
}

// Says how a save would store the secret, so the form can warn before the admin pastes anything.
export function readKeyStorage(environment: Environment = process.env) {
  if (isPreview(environment)) return KEY_STORAGE.refused;
  return readSetupToken(environment) ? KEY_STORAGE.sealed : KEY_STORAGE.unencrypted;
}

export async function saveVillageKeys(database: DatabaseOrTransaction, keys: VillageKeys, environment: Environment = process.env) {
  // A preview may share production's database. Its token would seal the keys so production can't read them.
  if (isPreview(environment)) {
    throw new RequestError(UNPROCESSABLE_STATUS, VILLAGE_ERROR_CODES.keysUnstorable, "Village keys can't be changed from a preview. Save them on your live site.");
  }
  const token = readSetupToken(environment);
  if (!token && looksSealed(keys.secretKey)) {
    throw new RequestError(UNPROCESSABLE_STATUS, VILLAGE_ERROR_CODES.keysUnstorable, "This key can't be saved until this site has a setup token. Add SETUP_TOKEN on your host, then try again.");
  }
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

export async function readMonthlyCreditCap(database: DatabaseOrTransaction) {
  const [setting] = await database
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.monthlyCreditCap));
  const cap = monthlyCapBodySchema.shape.cap.safeParse(Number(setting?.value));
  return cap.success ? cap.data : MONTHLY_CREDIT_CAPS.default;
}

export async function saveMonthlyCreditCap(database: DatabaseOrTransaction, cap: number) {
  await saveSettings(database, { [INSTANCE_SETTING_KEYS.monthlyCreditCap]: String(cap) });
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
