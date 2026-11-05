import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { MESSAGE_LIMITS } from "./contract.ts";
import { user } from "../../platform/database/auth-schema.ts";

const MILLISECOND_PRECISION = 3;
const MAXIMUM_BODY_LENGTH = sql.raw(String(MESSAGE_LIMITS.bodyLength));

function messageTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

export const conversation = pgTable(
  "conversation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberLowId: text("member_low_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    memberHighId: text("member_high_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastRevision: integer("last_revision").notNull().default(0),
    createdAt: messageTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("conversation_member_pair_unique").on(table.memberLowId, table.memberHighId),
    index("conversation_member_high_id_idx").on(table.memberHighId),
    check("conversation_pair_canonical", sql`${table.memberLowId} collate "C" < ${table.memberHighId} collate "C"`),
  ],
);

export const directMessage = pgTable(
  "direct_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clientKey: uuid("client_key").notNull(),
    body: text("body"),
    sequence: integer("sequence").notNull(),
    revision: integer("revision").notNull(),
    isWithheld: boolean("is_withheld").notNull().default(false),
    createdAt: messageTimestamp("created_at").notNull().defaultNow(),
    deletedAt: messageTimestamp("deleted_at"),
  },
  (table) => [
    unique("direct_message_client_key_unique").on(table.conversationId, table.senderId, table.clientKey),
    unique("direct_message_sequence_unique").on(table.conversationId, table.sequence),
    index("direct_message_revision_idx").on(table.conversationId, table.revision),
    index("direct_message_sender_id_idx").on(table.senderId),
    check(
      "direct_message_body_present",
      sql`(${table.deletedAt} is null and ${table.body} is not null and char_length(${table.body}) between 1 and ${MAXIMUM_BODY_LENGTH}) or (${table.deletedAt} is not null and ${table.body} is null)`,
    ),
  ],
);

export const conversationReadCursor = pgTable(
  "conversation_read_cursor",
  {
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversation.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastReadSequence: integer("last_read_sequence").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.memberId] }),
    index("conversation_read_cursor_member_id_idx").on(table.memberId),
  ],
);

export const messageReport = pgTable(
  "message_report",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").references(() => directMessage.id, { onDelete: "set null" }),
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    reportedMemberId: text("reported_member_id").references(() => user.id, { onDelete: "set null" }),
    messageBody: text("message_body").notNull(),
    messageSentAt: messageTimestamp("message_sent_at").notNull(),
    createdAt: messageTimestamp("created_at").notNull().defaultNow(),
    resolution: text("resolution"),
    resolvedAt: messageTimestamp("resolved_at"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    resolvedByName: text("resolved_by_name"),
  },
  (table) => [
    unique("message_report_reporter_message_unique").on(table.reporterId, table.messageId),
    index("message_report_created_at_idx").on(table.createdAt),
    index("message_report_message_id_idx").on(table.messageId),
    index("message_report_reported_member_id_idx").on(table.reportedMemberId),
    check("message_report_body_length", sql`char_length(${table.messageBody}) between 1 and ${MAXIMUM_BODY_LENGTH}`),
  ],
);
