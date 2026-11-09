import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "../database/auth-schema.ts";

const MILLISECOND_PRECISION = 3;

function weeklyTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

// One numbered thing a member can answer. The platform doesn't know what an ask or an intro is:
// `kind` and `ref` are whatever the shell put there when it built the email.
export type WeeklyEmailItem = { number: number; kind: string; ref: string; title: string };

// One row per member and week. It is written in the same transaction as the email it queues, so a
// job stopped half way knows exactly who still needs this week's email.
export const weeklyEmail = pgTable(
  "weekly_email",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    weekKey: text("week_key").notNull(),
    status: text("status").notNull(),
    items: jsonb("items").$type<WeeklyEmailItem[]>().notNull(),
    outboxId: uuid("outbox_id"),
    createdAt: weeklyTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("weekly_email_one_per_week").on(table.memberId, table.weekKey),
    index("weekly_email_member_created_idx").on(table.memberId, table.createdAt),
    check("weekly_email_status_known", sql`${table.status} in ('queued', 'empty', 'not_wanted', 'test')`),
  ],
);

// An item answered once, by link or by reply. The primary key is what makes a second answer do nothing.
export const weeklyEmailAction = pgTable(
  "weekly_email_action",
  {
    weeklyEmailId: uuid("weekly_email_id")
      .notNull()
      .references(() => weeklyEmail.id, { onDelete: "cascade" }),
    itemNumber: integer("item_number").notNull(),
    action: text("action").notNull(),
    via: text("via").notNull(),
    createdAt: weeklyTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.weeklyEmailId, table.itemNumber] }),
    check("weekly_email_action_via_known", sql`${table.via} in ('link', 'reply')`),
  ],
);
