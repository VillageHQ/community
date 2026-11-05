import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { readActiveSession } from "./active-session.ts";
import { ROUTES } from "./routes.ts";
import { isAdminMember } from "./village/member-network.ts";

const readSession = cache(async () => readActiveSession(await headers()));

export async function requireMember() {
  const session = await readSession();
  if (!session) redirect(ROUTES.signIn);
  return session.user;
}

export async function requireAdmin() {
  const member = await requireMember();
  if (!isAdminMember(member)) redirect(ROUTES.feed);
  return member;
}
