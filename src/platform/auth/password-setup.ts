import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { account, user } from "../database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../database/client.ts";

const CREDENTIAL_PROVIDER_ID = "credential";

export async function hasPassword(connection: DatabaseOrTransaction, memberId: string) {
  const [password] = await connection
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, memberId), eq(account.providerId, CREDENTIAL_PROVIDER_ID)));
  return Boolean(password);
}

// For a member who signs in by emailed link and has no password yet. Changing a password stays with Forgot password.
export async function addPassword(database: Database, memberId: string, newPassword: string) {
  const passwordHash = await hashPassword(newPassword);
  return database.transaction(async (transaction) => {
    await transaction.select({ id: user.id }).from(user).where(eq(user.id, memberId)).for("update");
    if (await hasPassword(transaction, memberId)) return false;
    await transaction.insert(account).values({
      id: randomUUID(),
      userId: memberId,
      accountId: memberId,
      providerId: CREDENTIAL_PROVIDER_ID,
      password: passwordHash,
    });
    return true;
  });
}
