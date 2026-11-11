import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

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

// One row per paid Village call this site made (search, a page of paths, a profile fill-in), with its estimate and
// who it was for. Admin › Village shows the month's lookups by kind and the latest ones from here.
export const villageCreditCall = pgTable(
  "village_credit_call",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    credits: integer("credits").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("village_credit_call_called_at").on(table.calledAt)],
);
