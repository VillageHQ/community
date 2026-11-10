import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import { ask } from "./schema.ts";

// A member's "not for me" on someone else's ask. It only hides the ask from their Today page and
// weekly email; the board still shows it.
export const askSkip = pgTable(
  "ask_skip",
  {
    askId: uuid("ask_id")
      .notNull()
      .references(() => ask.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.askId, table.memberId] })],
);
