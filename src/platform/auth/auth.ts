import { getDatabase } from "../database/client.ts";
import { resolveAuthSecret } from "./auth-secret.ts";
import { createAuth } from "./create-auth.ts";

async function buildAuth() {
  const database = getDatabase();
  const secret = await resolveAuthSecret(database, process.env);
  return createAuth(secret, database, process.env);
}

let sharedAuth: ReturnType<typeof buildAuth> | undefined;

export function getAuth() {
  sharedAuth ??= buildAuth().catch((error: unknown) => {
    sharedAuth = undefined;
    throw error;
  });
  return sharedAuth;
}
