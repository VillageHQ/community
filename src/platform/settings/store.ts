import "server-only";

import { inArray, sql } from "drizzle-orm";

import type { DatabaseOrTransaction } from "../database/client.ts";
import { instanceSettings } from "./schema.ts";

export async function readSettings(database: DatabaseOrTransaction, keys: string[]) {
  const settings = await database
    .select({ key: instanceSettings.key, value: instanceSettings.value })
    .from(instanceSettings)
    .where(inArray(instanceSettings.key, keys));
  return new Map(settings.map(({ key, value }) => [key, value]));
}

export async function saveSettings(database: DatabaseOrTransaction, settings: Record<string, string>) {
  await database
    .insert(instanceSettings)
    .values(Object.entries(settings).map(([key, value]) => ({ key, value })))
    .onConflictDoUpdate({
      target: instanceSettings.key,
      set: { value: sql`excluded.value`, updatedAt: new Date() },
    });
}
