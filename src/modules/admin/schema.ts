import { desc, sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { REPORT_TARGETS } from "./contract.ts";
import { FEED_LIMITS } from "../feed/contract.ts";
import { user } from "../../platform/database/auth-schema.ts";

const MILLISECOND_PRECISION = 3;

function adminTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

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
