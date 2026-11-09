import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "../database/auth-schema.ts";

const MILLISECOND_PRECISION = 3;

function emailTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

// One row per email. It is written in the same transaction as the change that causes it,
// so a crash can't lose it, and the row id is Resend's Idempotency-Key, so a retry can't double it.
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    toEmail: text("to_email").notNull(),
    memberId: text("member_id").references(() => user.id, { onDelete: "cascade" }),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    // Optional. Where a reply goes, when the app reads replies to this email.
    replyTo: text("reply_to"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: emailTimestamp("next_attempt_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: emailTimestamp("created_at").notNull().defaultNow(),
    finishedAt: emailTimestamp("finished_at"),
    // Optional. A second queue call with the same key finds the first row instead of adding one.
    dedupeKey: text("dedupe_key").unique(),
  },
  (table) => [
    index("email_outbox_due_idx").on(table.nextAttemptAt).where(sql`${table.status} in ('pending', 'sending')`),
    index("email_outbox_finished_idx").on(table.status, table.finishedAt),
    check("email_outbox_status", sql`${table.status} in ('pending', 'sending', 'sent', 'failed', 'skipped')`),
  ],
);

// A member who turned off one topic of email. No row means the topic is on.
export const emailOptOut = pgTable(
  "email_opt_out",
  {
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    createdAt: emailTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.memberId, table.topic] })],
);

// Addresses that bounced or complained. Only non-transactional email checks it.
export const emailSuppression = pgTable(
  "email_suppression",
  {
    email: text("email").primaryKey(),
    reason: text("reason").notNull(),
    createdAt: emailTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [check("email_suppression_email_is_lowercase", sql`${table.email} = lower(${table.email})`)],
);
