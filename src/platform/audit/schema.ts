import { desc } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "../database/auth-schema.ts";

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
