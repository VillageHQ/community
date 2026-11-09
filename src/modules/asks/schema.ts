import { desc, sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import { ASK_CATEGORIES, ASK_HELPER_REASONS, ASK_KINDS, ASK_LIMITS, ASK_OUTCOMES } from "./contract.ts";

const MILLISECOND_PRECISION = 3;

function askTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

function toSqlList(values: Record<string, string>) {
  return sql.raw(
    Object.values(values)
      .map((value) => `'${value}'`)
      .join(", "),
  );
}

export const ask = pgTable(
  "ask",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    detail: text("detail"),
    category: text("category").notNull(),
    kind: text("kind").notNull().default(ASK_KINDS.ask),
    // The person the ask wants to reach, as a LinkedIn profile name. Optional; only asks have one.
    targetSlug: text("target_slug"),
    targetName: text("target_name"),
    listedAt: askTimestamp("listed_at").notNull().defaultNow(),
    closedAt: askTimestamp("closed_at"),
    outcome: text("outcome"),
    createdAt: askTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ask_board_idx")
      .on(desc(table.listedAt), desc(table.id))
      .where(sql`${table.closedAt} is null`),
    index("ask_author_id_idx").on(table.authorId),
    check("ask_kind_known", sql`${table.kind} in (${toSqlList(ASK_KINDS)})`),
    check("ask_target_only_on_asks", sql`${table.targetSlug} is null or ${table.kind} = '${sql.raw(ASK_KINDS.ask)}'`),
    index("ask_author_created_idx").on(table.authorId, table.createdAt),
    check("ask_category_known", sql`${table.category} in (${toSqlList(ASK_CATEGORIES)})`),
    check("ask_outcome_known", sql`${table.outcome} in (${toSqlList(ASK_OUTCOMES)})`),
    check("ask_closed_with_outcome", sql`(${table.closedAt} is null) = (${table.outcome} is null)`),
    check("ask_title_length", sql`char_length(${table.title}) between 1 and ${sql.raw(String(ASK_LIMITS.titleLength))}`),
    check("ask_detail_length", sql`char_length(${table.detail}) between 1 and ${sql.raw(String(ASK_LIMITS.detailLength))}`),
  ],
);

export const askOffer = pgTable(
  "ask_offer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    askId: uuid("ask_id")
      .notNull()
      .references(() => ask.id, { onDelete: "cascade" }),
    helperId: text("helper_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    seenAt: askTimestamp("seen_at"),
    createdAt: askTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("ask_offer_one_per_helper").on(table.askId, table.helperId),
    index("ask_offer_helper_id_idx").on(table.helperId),
    check("ask_offer_note_length", sql`char_length(${table.note}) between 1 and ${sql.raw(String(ASK_LIMITS.noteLength))}`),
  ],
);

// A member the ask was routed to: one with a path to the person it names, or one whose "can help with" shares a
// word with it. `notifiedAt` makes the email go once, whatever happens to the ask later.
export const askHelper = pgTable(
  "ask_helper",
  {
    askId: uuid("ask_id")
      .notNull()
      .references(() => ask.id, { onDelete: "cascade" }),
    helperId: text("helper_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    why: text("why").notNull(),
    // For a path helper, their LinkedIn profile name on the author's path, so the author can ask them for the intro.
    connectorSlug: text("connector_slug"),
    notifiedAt: askTimestamp("notified_at"),
    createdAt: askTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.askId, table.helperId] }),
    index("ask_helper_helper_id_idx").on(table.helperId),
    check("ask_helper_reason_known", sql`${table.reason} in (${toSqlList(ASK_HELPER_REASONS)})`),
  ],
);

// "I've done this myself": a public answer under an ask, one per member.
export const askAnswer = pgTable(
  "ask_answer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    askId: uuid("ask_id")
      .notNull()
      .references(() => ask.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: askTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("ask_answer_one_per_member").on(table.askId, table.authorId),
    index("ask_answer_author_id_idx").on(table.authorId),
    check("ask_answer_body_length", sql`char_length(${table.body}) between 1 and ${sql.raw(String(ASK_LIMITS.answerLength))}`),
  ],
);
