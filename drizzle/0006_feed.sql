CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_body_length" CHECK (char_length("comment"."body") between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "moderation_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"target_author_id" text,
	"target_author_name" text NOT NULL,
	"target_body" text NOT NULL,
	"removed_reply_count" integer DEFAULT 0 NOT NULL,
	"deleted_by_user_id" text,
	"deleted_by_name" text NOT NULL,
	"deleted_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_record_target_known" CHECK ("moderation_record"."target_type" in ('post', 'comment'))
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"type" text DEFAULT 'plain' NOT NULL,
	"body" text NOT NULL,
	"pinned_at" timestamp (3) with time zone,
	"pinned_by_user_id" text,
	"edited_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_type_known" CHECK ("post"."type" in ('plain', 'ask', 'win', 'offer')),
	CONSTRAINT "post_body_length" CHECK (char_length("post"."body") between 1 and 3000)
);
--> statement-breakpoint
CREATE TABLE "reaction" (
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"reaction" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reaction_post_id_user_id_reaction_pk" PRIMARY KEY("post_id","user_id","reaction"),
	CONSTRAINT "reaction_known" CHECK ("reaction"."reaction" in ('heart', 'thumbs_up', 'idea', 'rocket'))
);
--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_record" ADD CONSTRAINT "moderation_record_target_author_id_user_id_fk" FOREIGN KEY ("target_author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_record" ADD CONSTRAINT "moderation_record_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_pinned_by_user_id_user_id_fk" FOREIGN KEY ("pinned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_thread_idx" ON "comment" USING btree ("post_id","created_at","id");--> statement-breakpoint
CREATE INDEX "comment_author_id_idx" ON "comment" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "moderation_record_deleted_at_idx" ON "moderation_record" USING btree ("deleted_at" desc);--> statement-breakpoint
CREATE INDEX "post_timeline_idx" ON "post" USING btree ("created_at" desc,"id" desc) WHERE "post"."pinned_at" is null;--> statement-breakpoint
CREATE INDEX "post_pinned_idx" ON "post" USING btree ("pinned_at" desc) WHERE "post"."pinned_at" is not null;--> statement-breakpoint
CREATE INDEX "post_author_id_idx" ON "post" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "reaction_user_id_idx" ON "reaction" USING btree ("user_id");