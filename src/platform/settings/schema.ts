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
  // When admins were last emailed about each Village trouble (out of credits, down, keys refused): once per spell, at
  // most once a day.
  villageAlertedOutOfCreditsAt: "village_alerted_out_of_credits_at",
  villageAlertedDownAt: "village_alerted_down_at",
  villageAlertedKeysRejectedAt: "village_alerted_keys_rejected_at",
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
  // The group the app's own search identity joined, so members who haven't connected can search the shared networks.
  villageSearchGroupId: "village_search_group_id",
  // Where this install keeps its data, and whom members ask about it. Only what the admin typed; empty means unset.
  dataLocation: "data_location",
  dataContactName: "data_contact_name",
  dataContactEmail: "data_contact_email",
  // Set up › Settings (Founderhall's settings page): hosting, plan, the mail sender, the default message policy.
  hostingBy: "hosting_by",
  plan: "plan",
  managedSetupBy: "managed_setup_by",
  mailFromName: "mail_from_name",
  mailDomain: "mail_domain",
  logoUrl: "logo_url",
  messagePolicyDefault: "message_policy_default",
  // Set up › Mail: the DKIM selector and reply subdomain the DNS check looks up.
  mailDkimSelector: "mail_dkim_selector",
  mailReplyDomain: "mail_reply_domain",
  // Set up › Village: what members read on the connect screen, the sync screen switches, the nightly fill-in.
  villageDataRegion: "village_data_region",
  villageDpaUrl: "village_dpa_url",
  villageEmbed: "village_embed",
  villageEmbedAuth: "village_embed_auth",
  villageFillInNightly: "village_fill_in_nightly",
  // Set up › Perks: whether members see the saved marketplace.
  perksEnabled: "perks_enabled",
  // Written only by the demo seed (DEMO_MODE=true). Its presence is what lets demo mode start on a database with members.
  demoSeededAt: "demo_seeded_at",
  demoResetAt: "demo_reset_at",
  // When the console's launch checklist was first all done; from then on the console opens on Home's dashboard.
  consoleLaunchedAt: "console_launched_at",
} as const;
