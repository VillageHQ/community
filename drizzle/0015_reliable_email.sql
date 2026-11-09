CREATE TABLE "email_opt_out" (
	"member_id" text NOT NULL,
	"topic" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_opt_out_member_id_topic_pk" PRIMARY KEY("member_id","topic")
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"to_email" text NOT NULL,
	"member_id" text,
	"subject" text NOT NULL,
	"html" text NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp (3) with time zone,
	CONSTRAINT "email_outbox_status" CHECK ("email_outbox"."status" in ('pending', 'sending', 'sent', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE "email_suppression" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_suppression_email_is_lowercase" CHECK ("email_suppression"."email" = lower("email_suppression"."email"))
);
--> statement-breakpoint
CREATE TABLE "job_lease" (
	"name" text PRIMARY KEY NOT NULL,
	"holder" text,
	"leased_until" timestamp (3) with time zone NOT NULL,
	"last_started_at" timestamp (3) with time zone,
	"last_finished_at" timestamp (3) with time zone,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "message_email_notice" (
	"conversation_id" uuid NOT NULL,
	"recipient_id" text NOT NULL,
	"emailed_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "message_email_notice_conversation_id_recipient_id_pk" PRIMARY KEY("conversation_id","recipient_id")
);
--> statement-breakpoint
ALTER TABLE "email_opt_out" ADD CONSTRAINT "email_opt_out_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_outbox" ADD CONSTRAINT "email_outbox_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_email_notice" ADD CONSTRAINT "message_email_notice_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_email_notice" ADD CONSTRAINT "message_email_notice_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_outbox_due_idx" ON "email_outbox" USING btree ("next_attempt_at") WHERE "email_outbox"."status" in ('pending', 'sending');--> statement-breakpoint
CREATE INDEX "email_outbox_finished_idx" ON "email_outbox" USING btree ("status","finished_at");