import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../database/instance-settings.ts";
import type { Environment } from "./environment.ts";

const GENERATED_SECRET_BYTES = 32;

export async function resolveAuthSecret(database: Database, environment: Environment) {
  if (environment.BETTER_AUTH_SECRET) return environment.BETTER_AUTH_SECRET;

  await database
    .insert(instanceSettings)
    .values({
      key: INSTANCE_SETTING_KEYS.authSecret,
      value: randomBytes(GENERATED_SECRET_BYTES).toString("hex"),
    })
    .onConflictDoNothing();

  const [storedSecret] = await database
    .select({ value: instanceSettings.value })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.authSecret));

  if (!storedSecret) throw new Error("The generated auth secret could not be read back.");
  return storedSecret.value;
}
