ALTER TABLE "email_outbox" ALTER COLUMN "next_attempt_at" SET DEFAULT date_trunc('milliseconds', now());--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "expires_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "target_reminder_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "stage" text;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "sector" text;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "cohort" text;