import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

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

// The last Village check: one row for the whole community. `startedAt` is claimed in one conditional write, so a
// second "Check again" inside a minute can't run beside the first.
export const villageCheck = pgTable("village_check", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  checkedAt: timestamp("checked_at", { withTimezone: true }),
  // ok, rejected, mismatched, missing, unreachable
  keys: text("keys"),
  // found, missing (no checked member has it), none (the community has no group yet)
  group: text("group_state"),
  groupMemberCount: integer("group_member_count"),
  checkedById: text("checked_by_id").references(() => user.id, { onDelete: "set null" }),
});

// What the last check found for one member. No row means the member wasn't there at the last check.
export const villageMemberCheck = pgTable("village_member_check", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // not_started (never sent to Village, so not asked), checked, unreachable (no answer in time or an error)
  outcome: text("outcome").notNull(),
  isProvisioned: boolean("is_provisioned").notNull().default(false),
  // Village's user status: not_connected, syncing, ready, needs_attention; null when not asked
  networkStatus: text("network_status"),
  isInGroup: boolean("is_in_group").notNull().default(false),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
});
