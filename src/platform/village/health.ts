import "server-only";

import { isVillageError, VillageError } from "@villagehq/sdk";
import { inArray, sql } from "drizzle-orm";

import type { Database, DatabaseOrTransaction } from "../database/client.ts";
import { logError } from "../observability/route-logging.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema.ts";
import { readSettings, saveSettings } from "../settings/store.ts";
import { alertAdminsAboutVillageSafely } from "./trouble-alerts.ts";

// Village counts as in trouble when it doesn't answer, or refuses this community's keys. Every other
// answer (out of credits, not found, busy) means Village is up and the keys work.
export const VILLAGE_TROUBLES = { down: "down", keysRejected: "keys_rejected" } as const;

export type VillageTrouble = (typeof VILLAGE_TROUBLES)[keyof typeof VILLAGE_TROUBLES];

const DOWN_CODES: ReadonlySet<string> = new Set(["server", "timeout", "network", "invalid_response", "token_failed"]);
const OK_WRITE_EVERY_MS = 60_000;

// Thrown before a call when its time budget is already spent. Village was never asked, so it says nothing about Village.
export class VillageDeadlineError extends VillageError {
  constructor() {
    super({ code: "timeout", message: "No time was left to call Village." });
  }
}

export function readVillageTrouble(error: unknown): VillageTrouble | null {
  if (!isVillageError(error) || error instanceof VillageDeadlineError) return null;
  if (error.code === "unauthorized") return VILLAGE_TROUBLES.keysRejected;
  return DOWN_CODES.has(error.code) ? VILLAGE_TROUBLES.down : null;
}

const HEALTH_KEYS = {
  lastOkAt: INSTANCE_SETTING_KEYS.villageLastOkAt,
  troubleAt: INSTANCE_SETTING_KEYS.villageTroubleAt,
  trouble: INSTANCE_SETTING_KEYS.villageTrouble,
} as const;

// A call that Village answered: it clears the trouble, and keeps "last worked" to the minute.
async function recordVillageAnswered(database: DatabaseOrTransaction, now: Date) {
  await database.delete(instanceSettings).where(inArray(instanceSettings.key, [HEALTH_KEYS.troubleAt, HEALTH_KEYS.trouble]));
  await database
    .insert(instanceSettings)
    .values({ key: HEALTH_KEYS.lastOkAt, value: now.toISOString(), updatedAt: now })
    .onConflictDoUpdate({
      target: instanceSettings.key,
      set: { value: sql`excluded.value`, updatedAt: now },
      where: sql`${instanceSettings.updatedAt} < ${new Date(now.getTime() - OK_WRITE_EVERY_MS).toISOString()}`,
    });
}

// Stores the trouble; true when it starts a new spell (none stored, or another kind), so admins are emailed once.
async function storeTrouble(database: Database, trouble: VillageTrouble, now: Date) {
  const changed = await database
    .insert(instanceSettings)
    .values({ key: HEALTH_KEYS.trouble, value: trouble, updatedAt: now })
    .onConflictDoUpdate({ target: instanceSettings.key, set: { value: sql`excluded.value`, updatedAt: now }, where: sql`${instanceSettings.value} <> excluded.value` })
    .returning({ key: instanceSettings.key });
  await saveSettings(database, { [HEALTH_KEYS.troubleAt]: now.toISOString() });
  return changed.length > 0;
}

// `error` is null for a call that worked. Returns what was recorded. A new spell of trouble emails the admins once.
export async function recordVillageOutcome(database: Database, error: unknown, now = new Date()) {
  // The app's own refusals (a daily limit, a spent time budget) never reached Village.
  if (error !== null && (!isVillageError(error) || error instanceof VillageDeadlineError)) return null;
  const trouble = error === null ? null : readVillageTrouble(error);
  if (trouble === null) {
    await recordVillageAnswered(database, now);
    return null;
  }
  if (await storeTrouble(database, trouble, now)) await alertAdminsAboutVillageSafely(database, trouble);
  return trouble;
}

// For the SDK's request hook, which can't wait: a failure to record never reaches the caller.
export function noteVillageOutcome(readDatabase: () => Database, error: unknown) {
  void (async () => recordVillageOutcome(readDatabase(), error))().catch((cause: unknown) => logError("village-health", cause));
}

export type VillageHealth = { trouble: VillageTrouble | null; troubleAt: string | null; lastOkAt: string | null };

export async function readVillageHealth(database: DatabaseOrTransaction): Promise<VillageHealth> {
  const settings = await readSettings(database, Object.values(HEALTH_KEYS));
  const stored = settings.get(HEALTH_KEYS.trouble);
  const trouble = stored === VILLAGE_TROUBLES.down || stored === VILLAGE_TROUBLES.keysRejected ? stored : null;
  return { trouble, troubleAt: trouble ? (settings.get(HEALTH_KEYS.troubleAt) ?? null) : null, lastOkAt: settings.get(HEALTH_KEYS.lastOkAt) ?? null };
}
