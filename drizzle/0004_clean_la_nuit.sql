CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" text,
	"invited_by_name" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" text,
	"revoked_at" timestamp with time zone,
	"email_status" text DEFAULT 'not_sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invite_email_is_lowercase" CHECK ("invite"."email" = lower("invite"."email"))
);
--> statement-breakpoint
CREATE TABLE "member_avatar" (
	"user_id" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "member_avatar_size" CHECK (octet_length("member_avatar"."bytes") <= 262144),
	CONSTRAINT "member_avatar_type" CHECK ("member_avatar"."content_type" in ('image/png', 'image/jpeg', 'image/webp'))
);
--> statement-breakpoint
CREATE TABLE "member_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"title" text,
	"company" text,
	"location" text,
	"bio" text,
	"can_help_with" text,
	"needs" text,
	"website" text,
	"card_step_done_at" timestamp with time zone,
	"onboarding_completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_tag" (
	"user_id" text NOT NULL,
	"normalized_tag" text NOT NULL,
	"tag" text NOT NULL,
	CONSTRAINT "member_tag_user_id_normalized_tag_pk" PRIMARY KEY("user_id","normalized_tag")
);
--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_accepted_user_id_user_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_avatar" ADD CONSTRAINT "member_avatar_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profile" ADD CONSTRAINT "member_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_tag" ADD CONSTRAINT "member_tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invite_open_email_unique" ON "invite" USING btree ("email") WHERE "invite"."accepted_at" is null and "invite"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "invite_created_at_idx" ON "invite" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "member_tag_normalized_tag_idx" ON "member_tag" USING btree ("normalized_tag");