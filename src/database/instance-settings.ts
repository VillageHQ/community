import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const instanceSettings = pgTable("instance_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const INSTANCE_SETTING_KEYS = {
  authSecret: "auth_secret",
  firstAdminUserId: "first_admin_user_id",
} as const;
