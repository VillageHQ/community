import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { account, user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { getAuth } from "../lib/auth.ts";

const MEMBER_PASSWORD = "a-long-test-password";
const CREDENTIAL_PROVIDER_ID = "credential";
const SESSION_COOKIE_PATTERN = /^[^;]+/;

export async function createSignedInMember(database: Database, role: "admin" | "user" = "user") {
  const userId = randomUUID();
  const email = `${userId}@members.test`;
  await database.insert(user).values({ id: userId, name: "Test Member", email, emailVerified: true, role });
  await database.insert(account).values({
    id: randomUUID(),
    userId,
    accountId: userId,
    providerId: CREDENTIAL_PROVIDER_ID,
    password: await hashPassword(MEMBER_PASSWORD),
  });

  const auth = await getAuth();
  const { headers } = await auth.api.signInEmail({
    body: { email, password: MEMBER_PASSWORD },
    returnHeaders: true,
  });
  const cookie = headers.getSetCookie()[0]?.match(SESSION_COOKIE_PATTERN)?.[0];
  if (!cookie) throw new Error("Sign-in set no session cookie.");

  return { userId, email, cookie };
}
