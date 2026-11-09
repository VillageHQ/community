import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { secretsMatch } from "../secrets/secrets-match.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../settings/schema.ts";

const GENERATED_SECRET_BYTES = 32;
const MINIMUM_SECRET_LENGTH = 32;
const BEARER_PREFIX = "Bearer ";

// A host's scheduler sends JOBS_TICK_SECRET (or Vercel's CRON_SECRET). Without either, the app
// makes its own and keeps it in its settings, so only its own self-tick knows it.
export async function resolveTickSecret(database: Database, environment: Environment) {
  const configured = environment.JOBS_TICK_SECRET?.trim() || environment.CRON_SECRET?.trim();
  if (configured) return configured.length >= MINIMUM_SECRET_LENGTH ? configured : null;

  await database
    .insert(instanceSettings)
    .values({ key: INSTANCE_SETTING_KEYS.jobsTickSecret, value: randomBytes(GENERATED_SECRET_BYTES).toString("hex") })
    .onConflictDoNothing();
  const [stored] = await database
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.jobsTickSecret));
  return stored?.value ?? null;
}

export async function isTickAuthorized(database: Database, environment: Environment, request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith(BEARER_PREFIX)) return false;
  const secret = await resolveTickSecret(database, environment);
  return secret !== null && secretsMatch(header.slice(BEARER_PREFIX.length), secret);
}
