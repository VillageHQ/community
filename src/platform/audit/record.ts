import "server-only";

import { eq } from "drizzle-orm";

import { adminAuditEntry } from "./schema.ts";
import { user } from "../database/auth-schema.ts";
import type { DatabaseOrTransaction } from "../database/client.ts";
import { type AuditAction } from "./actions.ts";

export const AUDIT_OUTSIDER_NAME = "Someone outside this community";

type AuditFacts = {
  action: AuditAction;
  targetMemberId?: string | null;
  targetName?: string | null;
  detail?: string | null;
};

async function readActorName(connection: DatabaseOrTransaction, actorId: string) {
  const [actor] = await connection.select({ name: user.name }).from(user).where(eq(user.id, actorId));
  return actor?.name ?? "";
}

export async function recordAdminAction(connection: DatabaseOrTransaction, actorId: string, facts: AuditFacts) {
  const actorName = await readActorName(connection, actorId);
  await connection.insert(adminAuditEntry).values({ ...facts, actorId, actorName });
}

// Many entries by one admin in one insert, for bulk work like a list of invites.
export async function recordAdminActions(connection: DatabaseOrTransaction, actorId: string, entries: AuditFacts[]) {
  if (entries.length === 0) return;
  const actorName = await readActorName(connection, actorId);
  await connection.insert(adminAuditEntry).values(entries.map((facts) => ({ ...facts, actorId, actorName })));
}

export async function recordOutsiderAction(connection: DatabaseOrTransaction, action: AuditAction) {
  await connection.insert(adminAuditEntry).values({ action, actorId: null, actorName: AUDIT_OUTSIDER_NAME });
}
