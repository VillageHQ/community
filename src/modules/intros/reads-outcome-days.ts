import "server-only";

import { sql } from "drizzle-orm";

import type { DatabaseOrTransaction } from "../../platform/database/client.ts";
import { readSettings } from "../../platform/settings/store.ts";
import { instanceSettings } from "../../platform/settings/schema.ts";
import { clampOutcomeDays, OUTCOME_DAYS, OUTCOME_DAYS_SETTING, OUTCOME_WINDOW_EXTRA_DAYS } from "./contract-outcome-days.ts";

export async function readOutcomeDays(database: DatabaseOrTransaction) {
  const settings = await readSettings(database, [OUTCOME_DAYS_SETTING]);
  return clampOutcomeDays(settings.get(OUTCOME_DAYS_SETTING));
}

// The saved days, read inside the query itself, so every outcome check stays one statement.
const outcomeDaysSql = sql`least(${sql.raw(String(OUTCOME_DAYS.maximum))}, greatest(${sql.raw(String(OUTCOME_DAYS.minimum))}, coalesce((select case when ${instanceSettings.value} ~ '^[0-9]{1,3}$' then ${instanceSettings.value}::int end from ${instanceSettings} where ${instanceSettings.key} = ${OUTCOME_DAYS_SETTING}), ${sql.raw(String(OUTCOME_DAYS.default))})))`;

// The moment an intro must have been made by for the outcome question to be due now.
export function outcomePromptedFromSql(now: Date) {
  return sql`(${now.toISOString()}::timestamptz - make_interval(days => ${outcomeDaysSql}))`;
}

// Intros made before this moment are never asked about.
export function outcomeWindowFromSql(now: Date) {
  return sql`(${now.toISOString()}::timestamptz - make_interval(days => ${outcomeDaysSql} + ${sql.raw(String(OUTCOME_WINDOW_EXTRA_DAYS))}))`;
}
