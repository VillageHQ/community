import { desc, sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import { ASK_CATEGORIES, ASK_LIMITS, ASK_OUTCOMES } from "./contract.ts";

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
