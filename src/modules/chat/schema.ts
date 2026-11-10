import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const MILLISECOND_PRECISION = 3;

function chatTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

// One row per chat tool. The token and the signing secret are sealed with the setup token when the site has one,
// and opened only in service-secrets.ts.
export const chatConnection = pgTable(
  "chat_connection",
  {
    kind: text("kind").primaryKey(),
    token: text("token").notNull(),
    signingSecret: text("signing_secret"),
    accountId: text("account_id"),
    accountName: text("account_name"),
    channelId: text("channel_id"),
    channelName: text("channel_name"),
    isPaused: boolean("is_paused").notNull().default(false),
    // Set when the tool refused the token (revoked, removed). Posting stops until the admin pastes a new one.
    isRefused: boolean("is_refused").notNull().default(false),
    lastPostAt: chatTimestamp("last_post_at"),
    lastError: text("last_error"),
    lastErrorAt: chatTimestamp("last_error_at"),
    connectedAt: chatTimestamp("connected_at").notNull().defaultNow(),
    // Items from before this moment are never posted: set on connecting and on resuming, so neither floods the channel.
    postsFromAt: chatTimestamp("posts_from_at").notNull().defaultNow(),
  },
  (table) => [check("chat_connection_kind_known", sql`${table.kind} in ('slack', 'discord')`)],
);

// What was posted where. The primary key is what makes an item post once per channel: a second claim finds the row.
// `ref` is what the shell named the item, like `ask:<id>` or `week:<date>`.
export const chatPost = pgTable(
  "chat_post",
  {
    kind: text("kind")
      .notNull()
      .references(() => chatConnection.kind, { onDelete: "cascade" }),
    ref: text("ref").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(1),
    error: text("error"),
    createdAt: chatTimestamp("created_at").notNull().defaultNow(),
    updatedAt: chatTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.kind, table.ref] }),
    check("chat_post_status_known", sql`${table.status} in ('sending', 'sent', 'failed')`),
  ],
);
