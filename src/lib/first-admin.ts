import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { account, user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "../database/instance-settings.ts";

const ADMIN_ROLE = "admin";
const CREDENTIAL_PROVIDER_ID = "credential";

export type FirstAdmin = { name: string; email: string; password: string };

export async function isFirstAdminClaimed(database: Database) {
  const [claim] = await database
    .select({ key: instanceSettings.key })
    .from(instanceSettings)
    .where(eq(instanceSettings.key, INSTANCE_SETTING_KEYS.firstAdminUserId));
  return Boolean(claim);
}

export async function claimFirstAdmin(database: Database, firstAdmin: FirstAdmin) {
  const passwordHash = await hashPassword(firstAdmin.password);
  const userId = randomUUID();

  return database.transaction(async (transaction) => {
    const claims = await transaction
      .insert(instanceSettings)
      .values({ key: INSTANCE_SETTING_KEYS.firstAdminUserId, value: userId })
      .onConflictDoNothing()
      .returning({ key: instanceSettings.key });
    if (claims.length === 0) return { claimed: false };

    await transaction.insert(user).values({
      id: userId,
      name: firstAdmin.name,
      email: firstAdmin.email.toLowerCase(),
      emailVerified: true,
      role: ADMIN_ROLE,
    });
    await transaction.insert(account).values({
      id: randomUUID(),
      userId,
      accountId: userId,
      providerId: CREDENTIAL_PROVIDER_ID,
      password: passwordHash,
    });
    return { claimed: true };
  });
}
