import "server-only";

import { randomBytes } from "node:crypto";

import type { getAuth } from "../auth/auth.ts";
import { toStoredIdentifier, verifySignInLink, type SignInLinkResult } from "../auth/sign-in-link-verify.ts";
import type { Database } from "../database/client.ts";
import { DEMO_GUARD, readDemoGuard } from "./guard.ts";
import { DEMO_ACCOUNTS, type DemoAccount } from "./mode.ts";

type Auth = Awaited<ReturnType<typeof getAuth>>;

const LINK_LIFETIME_MS = 60_000;
const TOKEN_BYTES = 24;

// "Try the demo": makes a one-minute sign-in link for the demo account on the server and uses it at once, so the
// visitor gets an ordinary session with no password and no email. Only on a database the demo seeded.
export async function signInDemoAccount(database: Database, auth: Auth, request: Request, account: DemoAccount): Promise<SignInLinkResult> {
  if ((await readDemoGuard(database)) !== DEMO_GUARD.demo) return { isSignedIn: false };
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const { internalAdapter } = await auth.$context;
  await internalAdapter.createVerificationValue({
    identifier: toStoredIdentifier(token),
    value: JSON.stringify({ type: "magic-link", email: DEMO_ACCOUNTS[account].email }),
    expiresAt: new Date(Date.now() + LINK_LIFETIME_MS),
  });
  return verifySignInLink(database, auth, request, token);
}
