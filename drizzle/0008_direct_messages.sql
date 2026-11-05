CREATE TABLE "conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_low_id" text NOT NULL,
	"member_high_id" text NOT NULL,
	"last_revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_member_pair_unique" UNIQUE("member_low_id","member_high_id"),
	CONSTRAINT "conversation_pair_canonical" CHECK ("conversation"."member_low_id" collate "C" < "conversation"."member_high_id" collate "C")
);
--> statement-breakpoint
CREATE TABLE "conversation_read_cursor" (
	"conversation_id" uuid NOT NULL,
	"member_id" text NOT NULL,
	"last_read_sequence" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "conversation_read_cursor_conversation_id_member_id_pk" PRIMARY KEY("conversation_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "direct_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"client_key" uuid NOT NULL,
	"body" text,
	"sequence" integer NOT NULL,
	"revision" integer NOT NULL,
	"is_withheld" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "direct_message_client_key_unique" UNIQUE("conversation_id","sender_id","client_key"),
	CONSTRAINT "direct_message_sequence_unique" UNIQUE("conversation_id","sequence"),
	CONSTRAINT "direct_message_body_present" CHECK (("direct_message"."deleted_at" is null and "direct_message"."body" is not null and char_length("direct_message"."body") between 1 and 4000) or ("direct_message"."deleted_at" is not null and "direct_message"."body" is null))
);
--> statement-breakpoint
CREATE TABLE "member_block" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "member_block_not_self" CHECK ("member_block"."blocker_id" <> "member_block"."blocked_id")
);
--> statement-breakpoint
CREATE TABLE "message_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid,
	"reporter_id" text,
	"reported_member_id" text,
	"message_body" text NOT NULL,
	"message_sent_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_report_reporter_message_unique" UNIQUE("reporter_id","message_id"),
	CONSTRAINT "message_report_body_length" CHECK (char_length("message_report"."message_body") between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_member_low_id_user_id_fk" FOREIGN KEY ("member_low_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_member_high_id_user_id_fk" FOREIGN KEY ("member_high_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_read_cursor" ADD CONSTRAINT "conversation_read_cursor_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_read_cursor" ADD CONSTRAINT "conversation_read_cursor_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_message" ADD CONSTRAINT "direct_message_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_block" ADD CONSTRAINT "member_block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_block" ADD CONSTRAINT "member_block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_message_id_direct_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."direct_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_report" ADD CONSTRAINT "message_report_reported_member_id_user_id_fk" FOREIGN KEY ("reported_member_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_member_high_id_idx" ON "conversation" USING btree ("member_high_id");--> statement-breakpoint
CREATE INDEX "conversation_read_cursor_member_id_idx" ON "conversation_read_cursor" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "direct_message_revision_idx" ON "direct_message" USING btree ("conversation_id","revision");--> statement-breakpoint
CREATE INDEX "direct_message_sender_id_idx" ON "direct_message" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "member_block_blocked_id_idx" ON "member_block" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "message_report_created_at_idx" ON "message_report" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "message_report_message_id_idx" ON "message_report" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_report_reported_member_id_idx" ON "message_report" USING btree ("reported_member_id");