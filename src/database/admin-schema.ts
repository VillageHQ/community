import { desc, sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { REPORT_TARGETS } from "../lib/admin/admin-api.ts";
import { FEED_LIMITS } from "../lib/feed/feed-api.ts";
import { user } from "./auth-schema.ts";

const MILLISECOND_PRECISION = 3;

function adminTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

export const adminAuditEntry = pgTable(
  "admin_audit_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    action: text("action").notNull(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    targetMemberId: text("target_member_id").references(() => user.id, { onDelete: "set null" }),
    targetName: text("target_name"),
    detail: text("detail"),
    createdAt: adminTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("admin_audit_entry_created_at_idx").on(desc(table.createdAt))],
);

export const contentReport = pgTable(
  "content_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    reportedMemberId: text("reported_member_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    contentCreatedAt: adminTimestamp("content_created_at").notNull(),
    createdAt: adminTimestamp("created_at").notNull().defaultNow(),
    resolution: text("resolution"),
    resolvedAt: adminTimestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    resolvedByName: text("resolved_by_name"),
  },
  (table) => [
    unique("content_report_reporter_target_unique").on(table.reporterId, table.targetType, table.targetId),
    index("content_report_created_at_idx").on(desc(table.createdAt)),
    index("content_report_target_idx").on(table.targetType, table.targetId),
    index("content_report_reported_member_id_idx").on(table.reportedMemberId),
    check(
      "content_report_target_known",
      sql`${table.targetType} in ('${sql.raw(REPORT_TARGETS.post)}', '${sql.raw(REPORT_TARGETS.comment)}', '${sql.raw(REPORT_TARGETS.introNote)}')`,
    ),
    check("content_report_body_length", sql`char_length(${table.body}) between 1 and ${sql.raw(String(FEED_LIMITS.postLength))}`),
  ],
);

export const memberRemoval = pgTable("member_removal", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  keepsContent: boolean("keeps_content").notNull(),
  removedByUserId: text("removed_by_user_id").references(() => user.id, { onDelete: "set null" }),
  removedAt: adminTimestamp("removed_at").notNull().defaultNow(),
  villageLeaveOutcome: text("village_leave_outcome"),
});
