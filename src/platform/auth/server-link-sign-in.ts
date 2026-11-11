import "server-only";

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import type { getAuth } from "./auth.ts";
import { toStoredIdentifier, verifySignInLink, type SignInLinkResult } from "./sign-in-link-verify.ts";

type Auth = Awaited<ReturnType<typeof getAuth>>;

const LINK_LIFETIME_MS = 60_000;
const TOKEN_BYTES = 24;

// Signs a member in with no password and no email: makes a one-minute sign-in link on the server and uses it at once,
// so the visitor gets an ordinary session. Callers decide who may be signed in this way (the demo, an accepted invite).
export async function signInWithServerLink(database: Database, auth: Auth, request: Request, email: string): Promise<SignInLinkResult> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const { internalAdapter } = await auth.$context;
  await internalAdapter.createVerificationValue({
    identifier: toStoredIdentifier(token),
    value: JSON.stringify({ type: "magic-link", email }),
    expiresAt: new Date(Date.now() + LINK_LIFETIME_MS),
  });
  return verifySignInLink(database, auth, request, token);
}

// A link sign-in marks the address confirmed. An invite accepted from a copied link proves nothing about the address,
// so the account goes back to unconfirmed and the confirmation email does that job.
export async function signInUnconfirmedMember(database: Database, auth: Auth, request: Request, member: { id: string; email: string }) {
  const result = await signInWithServerLink(database, auth, request, member.email);
  await database.update(user).set({ emailVerified: false }).where(eq(user.id, member.id));
  return result;
}
