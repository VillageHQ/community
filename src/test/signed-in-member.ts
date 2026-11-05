import { createHmac, randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";

import { account, user } from "../platform/database/auth-schema.ts";
import type { Database } from "../platform/database/client.ts";
import { getAuth } from "../platform/auth/auth.ts";

const MEMBER_PASSWORD = "a-long-test-password";
const CREDENTIAL_PROVIDER_ID = "credential";
const COOKIE_SIGNATURE_ALGORITHM = "sha256";

let memberPasswordHash: Promise<string> | undefined;

// Scrypt dominates the cost of a member, and a hook that makes five of them times out on a busy machine. One hash per run is enough.
function readMemberPasswordHash() {
  memberPasswordHash ??= hashPassword(MEMBER_PASSWORD);
  return memberPasswordHash;
}

// Signing in would verify the password with scrypt again, so this creates the session directly.
async function createSessionCookie(userId: string) {
  const auth = await getAuth();
  const { internalAdapter, authCookies, secret } = await auth.$context;
  const { token } = await internalAdapter.createSession(userId);
  const signature = createHmac(COOKIE_SIGNATURE_ALGORITHM, secret).update(token).digest("base64");
  return `${authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${signature}`)}`;
}

export async function createSignedInMember(database: Database, role: "admin" | "user" = "user") {
  const userId = randomUUID();
  const email = `${userId}@members.test`;
  await database.insert(user).values({ id: userId, name: "Test Member", email, emailVerified: true, role });
  await database.insert(account).values({
    id: randomUUID(),
    userId,
    accountId: userId,
    providerId: CREDENTIAL_PROVIDER_ID,
    password: await readMemberPasswordHash(),
  });

  return { userId, email, cookie: await createSessionCookie(userId) };
}
