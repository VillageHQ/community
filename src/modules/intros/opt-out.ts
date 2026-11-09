import "server-only";

import { createHmac } from "node:crypto";

import { eq } from "drizzle-orm";

import { resolveAuthSecret } from "../../platform/auth/auth-secret.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import type { Environment } from "../../platform/environment.ts";
import { introOptOut } from "./schema.ts";

// A LinkedIn slug is public, so a plain hash of it could be reversed by hashing guessed slugs. A keyed hash with the
// app's secret can't be checked without that secret. Rotating BETTER_AUTH_SECRET forgets earlier stop-all choices.
export async function hashTargetSlug(database: Database, environment: Environment, targetSlug: string) {
  const secret = await resolveAuthSecret(database, environment);
  return createHmac("sha256", secret).update(`intro-opt-out:${targetSlug}`).digest("hex");
}

export async function isSlugHashOptedOut(connection: DatabaseOrTransaction, targetSlugHash: string) {
  const [optOut] = await connection.select({ targetSlugHash: introOptOut.targetSlugHash }).from(introOptOut).where(eq(introOptOut.targetSlugHash, targetSlugHash));
  return optOut !== undefined;
}

export async function isTargetOptedOut(database: Database, environment: Environment, targetSlug: string) {
  return isSlugHashOptedOut(database, await hashTargetSlug(database, environment, targetSlug));
}
