CREATE TABLE "weekly_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" text NOT NULL,
	"week_key" text NOT NULL,
	"status" text NOT NULL,
	"items" jsonb NOT NULL,
	"outbox_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_email_one_per_week" UNIQUE("member_id","week_key"),
	CONSTRAINT "weekly_email_status_known" CHECK ("weekly_email"."status" in ('queued', 'empty', 'not_wanted', 'test'))
);
--> statement-breakpoint
CREATE TABLE "weekly_email_action" (
	"weekly_email_id" uuid NOT NULL,
	"item_number" integer NOT NULL,
	"action" text NOT NULL,
	"via" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_email_action_weekly_email_id_item_number_pk" PRIMARY KEY("weekly_email_id","item_number"),
	CONSTRAINT "weekly_email_action_via_known" CHECK ("weekly_email_action"."via" in ('link', 'reply'))
);
--> statement-breakpoint
CREATE TABLE "ask_skip" (
	"ask_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_skip_ask_id_member_id_pk" PRIMARY KEY("ask_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "reply_to" text;--> statement-breakpoint
ALTER TABLE "weekly_email" ADD CONSTRAINT "weekly_email_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_email_action" ADD CONSTRAINT "weekly_email_action_weekly_email_id_weekly_email_id_fk" FOREIGN KEY ("weekly_email_id") REFERENCES "public"."weekly_email"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_skip" ADD CONSTRAINT "ask_skip_ask_id_ask_id_fk" FOREIGN KEY ("ask_id") REFERENCES "public"."ask"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_skip" ADD CONSTRAINT "ask_skip_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "weekly_email_member_created_idx" ON "weekly_email" USING btree ("member_id","created_at");--> statement-breakpoint
-- The feed now starts off for new communities. A community that already has members keeps the feed
-- it has today: with no stored choice it was on, so that is stored. A stored choice is never changed.
INSERT INTO "instance_settings" ("key", "value")
SELECT 'module_state:feed', 'on'
WHERE EXISTS (SELECT 1 FROM "user")
ON CONFLICT ("key") DO NOTHING;
