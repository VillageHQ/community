import "server-only";

import { count, desc, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

import { adminAuditEntry } from "../../platform/audit/schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { moderationRecord } from "../../modules/feed/schema.ts";
import { MODERATION_TARGETS } from "../../modules/feed/contract.ts";
import { ADMIN_PAGE_SIZES, AUDIT_KINDS, auditPageSchema, type AuditPage } from "./admin-api.ts";

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
