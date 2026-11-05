import { sql } from "drizzle-orm";

import { getDatabase } from "../database/client.ts";
import { areMigrationsApplied } from "../database/migrations-status.ts";
import { logError } from "./route-logging.ts";
import { withDeadline } from "./with-deadline.ts";

const HEALTH_DEADLINE_MS = 4_000;

async function checkDatabase() {
  const database = getDatabase();
  await database.execute(sql`select 1`);
  return areMigrationsApplied(database);
}

export async function isAppHealthy() {
  try {
    return await withDeadline(checkDatabase(), HEALTH_DEADLINE_MS, "Health check timed out.");
  } catch (error) {
    logError("health", error);
    return false;
  }
}
