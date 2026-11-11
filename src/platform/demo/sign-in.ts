import "server-only";

import type { getAuth } from "../auth/auth.ts";
import { signInWithServerLink } from "../auth/server-link-sign-in.ts";
import type { SignInLinkResult } from "../auth/sign-in-link-verify.ts";
import type { Database } from "../database/client.ts";
import { DEMO_GUARD, readDemoGuard } from "./guard.ts";
import { DEMO_ACCOUNTS, type DemoAccount } from "./mode.ts";

type Auth = Awaited<ReturnType<typeof getAuth>>;

// "Try it as …": signs the demo account in with no password and no email. Only on a database the demo seeded.
export async function signInDemoAccount(database: Database, auth: Auth, request: Request, account: DemoAccount): Promise<SignInLinkResult> {
  if ((await readDemoGuard(database)) !== DEMO_GUARD.demo) return { isSignedIn: false };
  return signInWithServerLink(database, auth, request, DEMO_ACCOUNTS[account].email);
}
