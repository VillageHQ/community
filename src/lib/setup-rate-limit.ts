import type { Database } from "../database/client.ts";
import { recordFailedAttempt } from "./attempt-rate-limit.ts";

const SETUP_KEY_PREFIX = "setup";

export function recordFailedSetupAttempt(database: Database, clientKey: string) {
  return recordFailedAttempt(database, `${SETUP_KEY_PREFIX}|${clientKey}`);
}
