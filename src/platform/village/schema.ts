import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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

// One row per UTC month: the community's estimated Village credits. A call reserves its estimate here
// before it runs, in one conditional upsert, so parallel calls can't pass the monthly cap.
// The warning columns are claimed once each, so each warning email goes out once a month.
export const villageMonthlyUsage = pgTable(
  "village_monthly_usage",
  {
    usageMonth: text("usage_month").primaryKey(),
    credits: integer("credits").notNull().default(0),
    fillInCredits: integer("fill_in_credits").notNull().default(0),
    warnedNearCapAt: timestamp("warned_near_cap_at", { withTimezone: true }),
    warnedAtCapAt: timestamp("warned_at_cap_at", { withTimezone: true }),
  },
  (table) => [
    check("village_monthly_usage_month", sql`${table.usageMonth} ~ '^[0-9]{4}-[0-9]{2}$'`),
    check("village_monthly_usage_credits", sql`${table.credits} >= 0 and ${table.fillInCredits} >= 0`),
  ],
);
