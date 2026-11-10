import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const instanceSettings = pgTable("instance_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const INSTANCE_SETTING_KEYS = {
  authSecret: "auth_secret",
  firstAdminUserId: "first_admin_user_id",
  villagePublicKey: "village_public_key",
  villageSecretKey: "village_secret_key",
  villageGroupId: "village_group_id",
  villageGroupInviteLink: "village_group_invite_link",
  dailyLookupLimit: "daily_lookup_limit",
  villageOutOfCreditsAt: "village_out_of_credits_at",
  // When Village last answered, and the trouble since (it didn't answer, or refused the keys). A later answer clears the trouble.
  villageLastOkAt: "village_last_ok_at",
  villageTroubleAt: "village_trouble_at",
  villageTrouble: "village_trouble",
  jobsTickSecret: "jobs_tick_secret",
  monthlyCreditCap: "monthly_credit_cap",
  fillInBasis: "fill_in_basis",
  fillInTermsDate: "fill_in_terms_date",
  partnerReportRecipients: "partner_report_recipients",
  partnerReportSharedAt: "partner_report_shared_at",
  villageSearchScope: "village_search_scope",
  villageIntroducers: "village_introducers",
  villageChosenIntroducerIds: "village_chosen_introducer_ids",
  villageServiceEmail: "village_service_email",
  // Where this install keeps its data, and whom members ask about it. Only what the admin typed; empty means unset.
  dataLocation: "data_location",
  dataContactName: "data_contact_name",
  dataContactEmail: "data_contact_email",
  // Written only by the demo seed (DEMO_MODE=true). Its presence is what lets demo mode start on a database with members.
  demoSeededAt: "demo_seeded_at",
  demoResetAt: "demo_reset_at",
} as const;
