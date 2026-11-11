CREATE TABLE "intro_thread" (
	"intro_id" uuid PRIMARY KEY NOT NULL,
	"target_email" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intro_thread_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intro_id" uuid NOT NULL,
	"author" text NOT NULL,
	"body" text NOT NULL,
	"source_email_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intro_thread_message_source_email_id_unique" UNIQUE("source_email_id"),
	CONSTRAINT "intro_thread_message_author_check" CHECK ("intro_thread_message"."author" in ('requester', 'target')),
	CONSTRAINT "intro_thread_message_body_check" CHECK (char_length("intro_thread_message"."body") between 1 and 4000)
);
--> statement-breakpoint
ALTER TABLE "intro_thread" ADD CONSTRAINT "intro_thread_intro_id_intro_request_id_fk" FOREIGN KEY ("intro_id") REFERENCES "public"."intro_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intro_thread_message" ADD CONSTRAINT "intro_thread_message_intro_id_intro_thread_intro_id_fk" FOREIGN KEY ("intro_id") REFERENCES "public"."intro_thread"("intro_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intro_thread_message_intro_idx" ON "intro_thread_message" USING btree ("intro_id","created_at");