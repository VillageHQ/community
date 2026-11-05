import "server-only";

import { eq } from "drizzle-orm";

import { session as sessionTable } from "../database/auth-schema.ts";
import { getDatabase } from "../database/client.ts";
import { getAuth } from "./auth.ts";
import { isBanActive } from "./members/active-member.ts";

export async function readActiveSession(headers: Headers) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  if (!isBanActive(session.user)) return session;

  await getDatabase().delete(sessionTable).where(eq(sessionTable.userId, session.user.id));
  return null;
}
