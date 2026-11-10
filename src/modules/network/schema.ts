import { jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";

export const memberPathResult = pgTable(
  "member_path_result",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    linkedinSlug: text("linkedin_slug").notNull(),
    paths: jsonb("paths"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.linkedinSlug] })],
);

// When an admin last reminded this member to connect their network. One reminder per 30 days.
export const memberConnectNudge = pgTable("member_connect_nudge", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull(),
});
