import { jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "../platform/database/auth-schema.ts";

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
