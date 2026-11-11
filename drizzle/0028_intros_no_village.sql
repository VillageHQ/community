ALTER TABLE "intro_request" ALTER COLUMN "introducer_linkedin_slug" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "is_named_target" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "suggested_target_email" text;--> statement-breakpoint
ALTER TABLE "intro_request" ADD CONSTRAINT "intro_request_suggested_email_while_open" CHECK ("intro_request"."suggested_target_email" is null or "intro_request"."state" in ('requested', 'accepted', 'asking_target', 'target_agreed'));