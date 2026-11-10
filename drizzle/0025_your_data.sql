CREATE TABLE "ask_tally" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"kind" text NOT NULL,
	"outcome" text,
	"created_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "ask_tally_category_known" CHECK ("ask_tally"."category" in ('intro', 'hire', 'customer', 'advice', 'other')),
	CONSTRAINT "ask_tally_kind_known" CHECK ("ask_tally"."kind" in ('ask', 'update')),
	CONSTRAINT "ask_tally_outcome_known" CHECK ("ask_tally"."outcome" in ('solved_here', 'solved_elsewhere', 'no_longer_needed'))
);
--> statement-breakpoint
CREATE TABLE "member_privacy" (
	"user_id" text PRIMARY KEY NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"message_policy" text DEFAULT 'anyone' NOT NULL,
	"accepts_intro_asks" boolean,
	"intro_asks_answered_at" timestamp with time zone,
	"intro_asks_answered_place" text,
	"hidden_changed_at" timestamp with time zone,
	"message_policy_changed_at" timestamp with time zone,
	CONSTRAINT "member_privacy_message_policy" CHECK ("member_privacy"."message_policy" in ('anyone', 'introduced')),
	CONSTRAINT "member_privacy_intro_asks_place" CHECK ("member_privacy"."intro_asks_answered_place" is null or "member_privacy"."intro_asks_answered_place" in ('onboarding', 'your_data'))
);
--> statement-breakpoint
ALTER TABLE "member_removal" ADD COLUMN "erased_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "member_removal" ADD COLUMN "village_cancel_outcome" text;--> statement-breakpoint
ALTER TABLE "member_privacy" ADD CONSTRAINT "member_privacy_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_tally_created_idx" ON "ask_tally" USING btree ("created_at");