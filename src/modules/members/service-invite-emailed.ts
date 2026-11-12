import "server-only";

import { createHmac } from "node:crypto";

import { resolveAuthSecret } from "../../platform/auth/auth-secret.ts";
import type { DatabaseOrTransaction } from "../../platform/database/client.ts";
import type { Environment } from "../../platform/environment.ts";
import { secretsMatch } from "../../platform/secrets/secrets-match.ts";

const PURPOSE = "invite-emailed";

// The owner's call (2026-11-12, Founderhall's flow): whoever opens the invite link that was EMAILED to them has shown
// they read that inbox, so joining confirms the address. The emailed link carries this mark beside its token: a keyed
// hash of the token with the app's secret, so nobody can add it to a bare link. The link an admin copies has no mark,
// so a join from a copied link still sends "Confirm your email".
export async function signEmailedInvite(connection: DatabaseOrTransaction, environment: Environment, token: string) {
  const secret = await resolveAuthSecret(connection, environment);
  return createHmac("sha256", secret).update(`${PURPOSE}:${token}`).digest("base64url");
}

export async function isEmailedInvite(connection: DatabaseOrTransaction, environment: Environment, token: string, mark: string | null | undefined) {
  if (!mark) return false;
  return secretsMatch(mark, await signEmailedInvite(connection, environment, token));
}
