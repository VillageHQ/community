import { date, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth-schema.ts";

export const memberNetwork = pgTable("member_network", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  villageExternalId: uuid("village_external_id").notNull().unique().defaultRandom(),
  linkedinSlug: text("linkedin_slug").unique(),
  linkedinConfirmedSlug: text("linkedin_confirmed_slug"),
  sharingConsentedAt: timestamp("sharing_consented_at", { withTimezone: true }),
  groupJoinedAt: timestamp("group_joined_at", { withTimezone: true }),
  pendingVillageEmail: text("pending_village_email"),
  approvedMemberEmail: text("approved_member_email"),
  approvedVillageEmail: text("approved_village_email"),
});

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

export const memberDailyUsage = pgTable(
  "member_daily_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    usageDate: date("usage_date", { mode: "string" }).notNull(),
    callCount: integer("call_count").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.usageDate] })],
);
