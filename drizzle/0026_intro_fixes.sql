ALTER TABLE "intro_request" ADD COLUMN "connector_reminder_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "expiry_email_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "target_answer" text;--> statement-breakpoint
ALTER TABLE "intro_request" ADD CONSTRAINT "intro_request_target_answer_known" CHECK ("intro_request"."target_answer" is null or "intro_request"."target_answer" in ('yes', 'no_thanks', 'stop_all_asks'));