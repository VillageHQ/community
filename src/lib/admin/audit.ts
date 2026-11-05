import "server-only";

import { count, desc, eq, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

import { adminAuditEntry } from "../../database/admin-schema.ts";
import { user } from "../../database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../database/client.ts";
import { moderationRecord } from "../../database/feed-schema.ts";
import { MODERATION_TARGETS } from "../feed/feed-api.ts";
import { ADMIN_PAGE_SIZES, AUDIT_KINDS, auditPageSchema, type AuditAction, type AuditPage } from "./admin-api.ts";

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

function selectAdminActions(database: Database) {
  return database
    .select({
      id: sql<string>`${adminAuditEntry.id}::text`.as("id"),
      kind: sql<string>`${AUDIT_KINDS.action}`.as("kind"),
      action: sql<string | null>`${adminAuditEntry.action}`.as("action"),
      actorId: sql<string | null>`${adminAuditEntry.actorId}`.as("actor_id"),
      actorName: sql<string>`${adminAuditEntry.actorName}`.as("actor_name"),
      targetName: sql<string | null>`${adminAuditEntry.targetName}`.as("target_name"),
      detail: sql<string | null>`${adminAuditEntry.detail}`.as("detail"),
      removedText: sql<string | null>`null::text`.as("removed_text"),
      removedReplyCount: sql<number>`0`.as("removed_reply_count"),
      createdAt: sql<string>`${adminAuditEntry.createdAt}`.as("created_at"),
    })
    .from(adminAuditEntry);
}

function selectDeletionRecords(database: Database) {
  const isPost = sql`${moderationRecord.targetType} = ${MODERATION_TARGETS.post}`;
  return database
    .select({
      id: sql<string>`${moderationRecord.id}::text`.as("id"),
      kind: sql<string>`case when ${isPost} then ${AUDIT_KINDS.postDeleted} else ${AUDIT_KINDS.commentDeleted} end`.as("kind"),
      action: sql<string | null>`null::text`.as("action"),
      actorId: sql<string | null>`${moderationRecord.deletedByUserId}`.as("actor_id"),
      actorName: sql<string>`${moderationRecord.deletedByName}`.as("actor_name"),
      targetName: sql<string | null>`${moderationRecord.targetAuthorName}`.as("target_name"),
      detail: sql<string | null>`null::text`.as("detail"),
      removedText: sql<string | null>`${moderationRecord.targetBody}`.as("removed_text"),
      removedReplyCount: sql<number>`${moderationRecord.removedReplyCount}`.as("removed_reply_count"),
      createdAt: sql<string>`${moderationRecord.deletedAt}`.as("created_at"),
    })
    .from(moderationRecord);
}

async function countAuditEntries(database: Database) {
  const [[actions], [deletions]] = await Promise.all([
    database.select({ entryCount: count() }).from(adminAuditEntry),
    database.select({ entryCount: count() }).from(moderationRecord),
  ]);
  return (actions?.entryCount ?? 0) + (deletions?.entryCount ?? 0);
}

export async function readAuditLog(database: Database, requestedPage: number): Promise<AuditPage> {
  const entryCount = await countAuditEntries(database);
  const pageCount = Math.max(1, Math.ceil(entryCount / ADMIN_PAGE_SIZES.auditEntries));
  const page = Math.min(requestedPage, pageCount);
  const rows = await unionAll(selectAdminActions(database), selectDeletionRecords(database))
    .orderBy(desc(sql`created_at`), desc(sql`id`))
    .limit(ADMIN_PAGE_SIZES.auditEntries)
    .offset((page - 1) * ADMIN_PAGE_SIZES.auditEntries);
  return auditPageSchema.parse({
    entries: rows.map((row) => ({
      ...row,
      removedReplyCount: Number(row.removedReplyCount),
      createdAt: new Date(row.createdAt).toISOString(),
    })),
    page,
    pageCount,
    entryCount,
  });
}
