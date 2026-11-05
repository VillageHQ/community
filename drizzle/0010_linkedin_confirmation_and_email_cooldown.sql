ALTER TABLE "intro_request" ADD COLUMN "asked_email_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "member_network" ADD COLUMN "linkedin_confirmed_slug" text;