import "server-only";

import type { Database } from "../../platform/database/client.ts";
import type { Environment } from "../../platform/environment.ts";

export async function sendDueConnectorReminders(_database: Database, _environment: Environment, _now = new Date()) {
  return { reminded: 0 };
}
