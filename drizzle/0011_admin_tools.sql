CREATE TABLE "admin_audit_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"target_member_id" text,
	"target_name" text,
	"detail" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reporter_id" text,
	"reported_member_id" text,
	"body" text NOT NULL,
	"content_created_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"resolution" text,
	"resolved_at" timestamp (3) with time zone,
	"resolved_by_user_id" text,
	"resolved_by_name" text,
	CONSTRAINT "content_report_reporter_target_unique" UNIQUE("reporter_id","target_type","target_id"),
	CONSTRAINT "content_report_target_known" CHECK ("content_report"."target_type" in ('post', 'comment', 'intro_note')),
	CONSTRAINT "content_report_body_length" CHECK (char_length("content_report"."body") between 1 and 3000)
);
--> statement-breakpoint
CREATE TABLE "member_removal" (
	"user_id" text PRIMARY KEY NOT NULL,
	"keeps_content" boolean NOT NULL,
	"removed_by_user_id" text,
	"removed_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_report" ADD COLUMN "resolution" text;--> statement-breakpoint
ALTER TABLE "message_report" ADD COLUMN "resolved_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "message_report" ADD COLUMN "resolved_by_user_id" text;--> statement-breakpoint
ALTER TABLE "message_report" ADD COLUMN "resolved_by_name" text;--> statement-breakpoint
ALTER TABLE "member_network" ADD COLUMN "village_linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_audit_entry" ADD CONSTRAINT "admin_audit_entry_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_entry" ADD CONSTRAINT "admin_audit_entry_target_member_id_user_id_fk" FOREIGN KEY ("target_member_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_reported_member_id_user_id_fk" FOREIGN KEY ("reported_member_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_removal" ADD CONSTRAINT "member_removal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_removal" ADD CONSTRAINT "member_removal_removed_by_user_id_user_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_entry_created_at_idx" ON "admin_audit_entry" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX "content_report_created_at_idx" ON "content_report" USING btree ("created_at" desc);--> statement-breakpoint
CREATE INDEX "content_report_target_idx" ON "content_report" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "content_report_reported_member_id_idx" ON "content_report" USING btree ("reported_member_id");--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;