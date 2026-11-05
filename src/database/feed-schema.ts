import { desc, sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { FEED_LIMITS, MODERATION_TARGETS, POST_TYPES, REACTIONS } from "../lib/feed/feed-api.ts";
import { user } from "./auth-schema.ts";

const MILLISECOND_PRECISION = 3;

function feedTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

function toSqlList(values: Record<string, string>) {
  return sql.raw(
    Object.values(values)
      .map((value) => `'${value}'`)
      .join(", "),
  );
}

export const post = pgTable(
  "post",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull().default(POST_TYPES.plain),
    body: text("body").notNull(),
    pinnedAt: feedTimestamp("pinned_at"),
    pinnedByUserId: text("pinned_by_user_id").references(() => user.id, { onDelete: "set null" }),
    editedAt: feedTimestamp("edited_at"),
    createdAt: feedTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("post_timeline_idx")
      .on(desc(table.createdAt), desc(table.id))
      .where(sql`${table.pinnedAt} is null`),
    index("post_pinned_idx")
      .on(desc(table.pinnedAt))
      .where(sql`${table.pinnedAt} is not null`),
    index("post_author_id_idx").on(table.authorId),
    check("post_type_known", sql`${table.type} in (${toSqlList(POST_TYPES)})`),
    check(
      "post_body_length",
      sql`char_length(${table.body}) between 1 and ${sql.raw(String(FEED_LIMITS.postLength))}`,
    ),
  ],
);

export const comment = pgTable(
  "comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    editedAt: feedTimestamp("edited_at"),
    createdAt: feedTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("comment_thread_idx").on(table.postId, table.createdAt, table.id),
    index("comment_author_id_idx").on(table.authorId),
    check(
      "comment_body_length",
      sql`char_length(${table.body}) between 1 and ${sql.raw(String(FEED_LIMITS.commentLength))}`,
    ),
  ],
);

export const reaction = pgTable(
  "reaction",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reaction: text("reaction").notNull(),
    createdAt: feedTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId, table.reaction] }),
    index("reaction_user_id_idx").on(table.userId),
    check("reaction_known", sql`${table.reaction} in (${toSqlList(REACTIONS)})`),
  ],
);

export const moderationRecord = pgTable(
  "moderation_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    parentPostId: uuid("parent_post_id"),
    targetAuthorId: text("target_author_id").references(() => user.id, { onDelete: "set null" }),
    targetAuthorName: text("target_author_name").notNull(),
    targetBody: text("target_body").notNull(),
    removedReplyCount: integer("removed_reply_count").notNull().default(0),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    deletedByName: text("deleted_by_name").notNull(),
    deletedAt: feedTimestamp("deleted_at").notNull().defaultNow(),
  },
  (table) => [
    index("moderation_record_deleted_at_idx").on(desc(table.deletedAt)),
    check("moderation_record_target_known", sql`${table.targetType} in (${toSqlList(MODERATION_TARGETS)})`),
  ],
);
