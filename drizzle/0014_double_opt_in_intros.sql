CREATE TABLE "intro_consent_link" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"intro_id" uuid NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intro_opt_out" (
	"target_slug_hash" text PRIMARY KEY NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intro_request" DROP CONSTRAINT "intro_request_state_known";--> statement-breakpoint
DROP INDEX "intro_request_open_unique";--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "decline_kind" text;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "target_email" text;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "consent_email_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "asked_target_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "target_agreed_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "outcome" text;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "outcome_answered_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "outcome_email_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "outcome_reminder_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_consent_link" ADD CONSTRAINT "intro_consent_link_intro_id_intro_request_id_fk" FOREIGN KEY ("intro_id") REFERENCES "public"."intro_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intro_consent_link_intro_idx" ON "intro_consent_link" USING btree ("intro_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intro_request_open_unique" ON "intro_request" USING btree ("requester_id","introducer_id","target_linkedin_slug") WHERE "intro_request"."state" in ('requested', 'accepted', 'asking_target', 'target_agreed');--> statement-breakpoint
ALTER TABLE "intro_request" ADD CONSTRAINT "intro_request_decline_kind" CHECK ("intro_request"."decline_kind" is null or ("intro_request"."state" = 'declined' and "intro_request"."decline_kind" in ('not_this_time', 'do_not_know_them')));--> statement-breakpoint
ALTER TABLE "intro_request" ADD CONSTRAINT "intro_request_target_email_while_open" CHECK ("intro_request"."target_email" is null or "intro_request"."state" in ('asking_target', 'target_agreed'));--> statement-breakpoint
ALTER TABLE "intro_request" ADD CONSTRAINT "intro_request_outcome_known" CHECK ("intro_request"."outcome" is null or ("intro_request"."state" = 'completed' and "intro_request"."outcome" in ('helped', 'not_yet', 'not_helped')));--> statement-breakpoint
ALTER TABLE "intro_request" ADD CONSTRAINT "intro_request_state_known" CHECK ("intro_request"."state" in ('requested', 'accepted', 'declined', 'withdrawn', 'completed', 'expired', 'asking_target', 'target_agreed', 'target_declined'));