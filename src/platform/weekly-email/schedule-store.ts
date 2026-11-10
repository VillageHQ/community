import "server-only";

import type { Database, DatabaseOrTransaction } from "../database/client.ts";
import { readSettings, saveSettings } from "../settings/store.ts";
import { parseWeeklySchedule, toScheduleSettings, WEEKLY_SCHEDULE_KEYS, type WeeklySchedule } from "./schedule.ts";

export async function readWeeklySchedule(database: Database) {
  return parseWeeklySchedule(await readSettings(database, Object.values(WEEKLY_SCHEDULE_KEYS)));
}

export async function saveWeeklySchedule(connection: DatabaseOrTransaction, schedule: WeeklySchedule) {
  await saveSettings(connection, toScheduleSettings(schedule));
}
