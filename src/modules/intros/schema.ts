import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { INTRO_LIMITS, INTRO_STATES, OPEN_INTRO_STATES } from "./contract.ts";
import { user } from "../../platform/database/auth-schema.ts";

const MILLISECOND_PRECISION = 3;

function toSqlLiterals(values: readonly string[]) {
  return sql.raw(values.map((value) => `'${value}'`).join(", "));
}

function toSqlNumber(value: number) {
  return sql.raw(String(value));
}

function introTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

export const introRequest = pgTable(
  "intro_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    introducerId: text("introducer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    targetLinkedinSlug: text("target_linkedin_slug").notNull(),
    targetName: text("target_name").notNull(),
    targetHeadline: text("target_headline"),
    introducerName: text("introducer_name").notNull(),
    introducerHeadline: text("introducer_headline"),
    introducerLinkedinSlug: text("introducer_linkedin_slug").notNull(),
    reason: text("reason").notNull(),
    note: text("note").notNull(),
    state: text("state").notNull().default(INTRO_STATES.requested),
    declineReason: text("decline_reason"),
    isWithheld: boolean("is_withheld").notNull().default(false),
    requesterHasUpdate: boolean("requester_has_update").notNull().default(false),
    askedEmailAt: introTimestamp("asked_email_at"),
    createdAt: introTimestamp("created_at").notNull().defaultNow(),
    acceptedAt: introTimestamp("accepted_at"),
    closedAt: introTimestamp("closed_at"),
    expiresAt: introTimestamp("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("intro_request_open_unique")
      .on(table.requesterId, table.introducerId, table.targetLinkedinSlug)
      .where(sql`${table.state} in (${toSqlLiterals(OPEN_INTRO_STATES)})`),
    index("intro_request_requester_created_idx").on(table.requesterId, table.createdAt),
    index("intro_request_introducer_created_idx").on(table.introducerId, table.createdAt),
    check("intro_request_state_known", sql`${table.state} in (${toSqlLiterals(Object.values(INTRO_STATES))})`),
    check("intro_request_not_self", sql`${table.requesterId} <> ${table.introducerId}`),
    check("intro_request_note_length", sql`char_length(${table.note}) between 1 and ${toSqlNumber(INTRO_LIMITS.noteLength)}`),
    check(
      "intro_request_decline_reason",
      sql`${table.declineReason} is null or (${table.state} = '${sql.raw(INTRO_STATES.declined)}' and char_length(${table.declineReason}) between 1 and ${toSqlNumber(INTRO_LIMITS.declineReasonLength)})`,
    ),
    check(
      "intro_request_snapshot_lengths",
      sql`char_length(${table.targetName}) between 1 and ${toSqlNumber(INTRO_LIMITS.nameLength)} and char_length(${table.introducerName}) between 1 and ${toSqlNumber(INTRO_LIMITS.nameLength)} and char_length(${table.reason}) between 1 and ${toSqlNumber(INTRO_LIMITS.reasonLength)}`,
    ),
  ],
);
