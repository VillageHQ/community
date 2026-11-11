CREATE TABLE "member_deletion_request" (
	"user_id" text PRIMARY KEY NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_fill_in" DROP CONSTRAINT "member_fill_in_field";--> statement-breakpoint
ALTER TABLE "member_privacy" DROP CONSTRAINT "member_privacy_message_policy";--> statement-breakpoint
ALTER TABLE "member_privacy" ALTER COLUMN "message_policy" SET DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "member_deletion_request" ADD CONSTRAINT "member_deletion_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_fill_in" ADD CONSTRAINT "member_fill_in_field" CHECK ("member_fill_in"."field" in ('title', 'company', 'location', 'headline', 'face', 'company_logo', 'company_domain', 'past_roles'));--> statement-breakpoint
ALTER TABLE "member_privacy" ADD CONSTRAINT "member_privacy_message_policy" CHECK ("member_privacy"."message_policy" in ('default', 'anyone', 'introduced'));