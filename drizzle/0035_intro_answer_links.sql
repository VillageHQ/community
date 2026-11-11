CREATE TABLE "intro_answer_link" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"intro_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intro_answer_link_purpose_known" CHECK ("intro_answer_link"."purpose" in ('connector', 'outcome'))
);
--> statement-breakpoint
ALTER TABLE "intro_thread_message" DROP CONSTRAINT "intro_thread_message_author_check";--> statement-breakpoint
ALTER TABLE "intro_answer_link" ADD CONSTRAINT "intro_answer_link_intro_id_intro_request_id_fk" FOREIGN KEY ("intro_id") REFERENCES "public"."intro_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intro_answer_link_intro_idx" ON "intro_answer_link" USING btree ("intro_id");--> statement-breakpoint
ALTER TABLE "intro_thread_message" ADD CONSTRAINT "intro_thread_message_author_check" CHECK ("intro_thread_message"."author" in ('requester', 'target', 'introducer'));