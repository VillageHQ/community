ALTER TABLE "member_fill_in" DROP CONSTRAINT "member_fill_in_field";--> statement-breakpoint
ALTER TABLE "member_privacy" DROP CONSTRAINT "member_privacy_message_policy";--> statement-breakpoint
ALTER TABLE "member_privacy" ALTER COLUMN "message_policy" SET DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "member_fill_in" ADD CONSTRAINT "member_fill_in_field" CHECK ("member_fill_in"."field" in ('title', 'company', 'location', 'headline', 'face', 'company_logo', 'company_domain', 'past_roles'));--> statement-breakpoint
ALTER TABLE "member_privacy" ADD CONSTRAINT "member_privacy_message_policy" CHECK ("member_privacy"."message_policy" in ('default', 'anyone', 'introduced'));