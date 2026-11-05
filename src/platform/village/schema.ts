import { date, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import { user } from "../database/auth-schema.ts";

export const memberDailyUsage = pgTable(
  "member_daily_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    usageDate: date("usage_date", { mode: "string" }).notNull(),
    callCount: integer("call_count").notNull(),
    searchCount: integer("search_count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.userId, table.usageDate] })],
);
