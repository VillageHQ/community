import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { INVITE_EMAIL_STATUSES } from "../lib/invites/invite-state.ts";
import { MAXIMUM_AVATAR_BYTES } from "../lib/members/avatar-rules.ts";
import { user } from "../platform/database/auth-schema.ts";
import { bytea } from "../platform/database/bytea.ts";

export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, { onDelete: "set null" }),
    invitedByName: text("invited_by_name").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedUserId: text("accepted_user_id").references(() => user.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    emailStatus: text("email_status").notNull().default(INVITE_EMAIL_STATUSES.notSent),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invite_open_email_unique")
      .on(table.email)
      .where(sql`${table.acceptedAt} is null and ${table.revokedAt} is null`),
    index("invite_created_at_idx").on(table.createdAt),
    check("invite_email_is_lowercase", sql`${table.email} = lower(${table.email})`),
  ],
);

export const memberProfile = pgTable("member_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  title: text("title"),
  company: text("company"),
  location: text("location"),
  bio: text("bio"),
  canHelpWith: text("can_help_with"),
  needs: text("needs"),
  website: text("website"),
  cardStepDoneAt: timestamp("card_step_done_at", { withTimezone: true }),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberTag = pgTable(
  "member_tag",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    normalizedTag: text("normalized_tag").notNull(),
    tag: text("tag").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.normalizedTag] }),
    index("member_tag_normalized_tag_idx").on(table.normalizedTag),
  ],
);

export const memberAvatar = pgTable(
  "member_avatar",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    bytes: bytea("bytes").notNull(),
    contentType: text("content_type").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check("member_avatar_size", sql`octet_length(${table.bytes}) <= ${sql.raw(String(MAXIMUM_AVATAR_BYTES))}`),
    check("member_avatar_type", sql`${table.contentType} in ('image/png', 'image/jpeg', 'image/webp')`),
  ],
);
