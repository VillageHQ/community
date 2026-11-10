import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, boolean } from "drizzle-orm/pg-core";

import { INVITE_EMAIL_STATUSES } from "./contract-invite-state.ts";
import { MAXIMUM_AVATAR_BYTES } from "./contract-avatar.ts";
import { CHOICE_PLACES, MESSAGE_POLICIES } from "./contract-privacy.ts";
import { user } from "../../platform/database/auth-schema.ts";
import { bytea } from "../../platform/database/bytea.ts";
import { emailOutbox } from "../../platform/email/schema.ts";

const MILLISECOND_PRECISION = 3;

export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    // From a bulk list or CSV: the join form starts with the name, and the company goes on the new member's card.
    inviteeName: text("invitee_name"),
    company: text("company"),
    cohort: text("cohort"),
    tokenHash: text("token_hash").notNull().unique(),
    invitedByUserId: text("invited_by_user_id").references(() => user.id, { onDelete: "set null" }),
    invitedByName: text("invited_by_name").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedUserId: text("accepted_user_id").references(() => user.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    emailStatus: text("email_status").notNull().default(INVITE_EMAIL_STATUSES.notSent),
    // The invite's latest queued email. Its outbox status is what the admin sees.
    emailOutboxId: uuid("email_outbox_id").references(() => emailOutbox.id, { onDelete: "set null" }),
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
  // Off by default. On, the member's name may appear among the top connectors in the admin's partner report.
  creditInReports: boolean("credit_in_reports").notNull().default(false),
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

export const memberNetwork = pgTable("member_network", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  villageExternalId: uuid("village_external_id").notNull().unique().defaultRandom(),
  linkedinSlug: text("linkedin_slug").unique(),
  linkedinConfirmedSlug: text("linkedin_confirmed_slug"),
  sharingConsentedAt: timestamp("sharing_consented_at", { withTimezone: true }),
  groupJoinedAt: timestamp("group_joined_at", { withTimezone: true }),
  villageLinkedAt: timestamp("village_linked_at", { withTimezone: true }),
  staleGroupExternalId: uuid("stale_group_external_id"),
  pendingVillageEmail: text("pending_village_email"),
  approvedMemberEmail: text("approved_member_email"),
  approvedVillageEmail: text("approved_village_email"),
});

export const memberBlock = pgTable(
  "member_block",
  {
    blockerId: text("blocker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, precision: MILLISECOND_PRECISION }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    index("member_block_blocked_id_idx").on(table.blockedId),
    check("member_block_not_self", sql`${table.blockerId} <> ${table.blockedId}`),
  ],
);

export const memberRemoval = pgTable("member_removal", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  keepsContent: boolean("keeps_content").notNull(),
  removedByUserId: text("removed_by_user_id").references(() => user.id, { onDelete: "set null" }),
  removedAt: timestamp("removed_at", { withTimezone: true, precision: MILLISECOND_PRECISION }).notNull().defaultNow(),
  villageLeaveOutcome: text("village_leave_outcome"),
  // Set when the account was deleted for real: the user row is then an empty placeholder with no personal data.
  erasedAt: timestamp("erased_at", { withTimezone: true, precision: MILLISECOND_PRECISION }),
  // What Village said when asked to cancel the member's Village user, recorded with the deletion.
  villageCancelOutcome: text("village_cancel_outcome"),
});

// A member's privacy switches. No row means the defaults: listed, anyone can message, and "accept intro asks" never
// answered (treated as yes for members who joined before the question existed).
export const memberPrivacy = pgTable(
  "member_privacy",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    isHidden: boolean("is_hidden").notNull().default(false),
    messagePolicy: text("message_policy").notNull().default(MESSAGE_POLICIES.anyone),
    acceptsIntroAsks: boolean("accepts_intro_asks"),
    introAsksAnsweredAt: timestamp("intro_asks_answered_at", { withTimezone: true }),
    introAsksAnsweredPlace: text("intro_asks_answered_place"),
    hiddenChangedAt: timestamp("hidden_changed_at", { withTimezone: true }),
    messagePolicyChangedAt: timestamp("message_policy_changed_at", { withTimezone: true }),
  },
  (table) => [
    check("member_privacy_message_policy", sql`${table.messagePolicy} in ('${sql.raw(MESSAGE_POLICIES.anyone)}', '${sql.raw(MESSAGE_POLICIES.introduced)}')`),
    check(
      "member_privacy_intro_asks_place",
      sql`${table.introAsksAnsweredPlace} is null or ${table.introAsksAnsweredPlace} in ('${sql.raw(CHOICE_PLACES.onboarding)}', '${sql.raw(CHOICE_PLACES.yourData)}')`,
    ),
  ],
);

// A member's own answer about the profile fill-in, and how their last lookup went.
// No row means they never answered and were never looked up.
export const memberLookup = pgTable(
  "member_lookup",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    refusedAt: timestamp("refused_at", { withTimezone: true }),
    status: text("status"),
    lookedUpAt: timestamp("looked_up_at", { withTimezone: true }),
    linkedinUrl: text("linkedin_url"),
  },
  (table) => [
    check("member_lookup_status", sql`${table.status} is null or ${table.status} in ('found', 'not_found', 'failed')`),
    index("member_lookup_looked_up_at_idx").on(table.lookedUpAt),
  ],
);

// One line filled in from public profiles. The member's own words live in member_profile and always win.
// A refresh replaces the value and the date, never hidden_at, so a hidden line stays hidden.
export const memberFillIn = pgTable(
  "member_fill_in",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    value: text("value").notNull(),
    filledAt: timestamp("filled_at", { withTimezone: true }).notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.field] }),
    check("member_fill_in_field", sql`${table.field} in ('title', 'company', 'location', 'headline', 'face', 'company_logo')`),
  ],
);
