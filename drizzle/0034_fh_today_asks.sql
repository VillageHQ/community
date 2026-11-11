ALTER TABLE "ask_answer" DROP CONSTRAINT "ask_answer_one_per_member";--> statement-breakpoint
ALTER TABLE "ask" DROP CONSTRAINT "ask_title_length";--> statement-breakpoint
ALTER TABLE "ask" ADD COLUMN "target_text" text;--> statement-breakpoint
ALTER TABLE "ask" ADD COLUMN "target_company" text;--> statement-breakpoint
ALTER TABLE "ask_answer" ADD COLUMN "kind" text DEFAULT 'answer' NOT NULL;--> statement-breakpoint
ALTER TABLE "ask_helper" ADD COLUMN "person_name" text;--> statement-breakpoint
ALTER TABLE "ask_helper" ADD COLUMN "person_title" text;--> statement-breakpoint
ALTER TABLE "ask_helper" ADD COLUMN "warmth" text;--> statement-breakpoint
ALTER TABLE "member_fill_in" ADD COLUMN "confirmed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ask_answer_ask_id_idx" ON "ask_answer" USING btree ("ask_id");--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_target_text_only_on_asks" CHECK (("ask"."target_text" is null and "ask"."target_company" is null) or "ask"."kind" = 'ask');--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_target_text_length" CHECK (char_length("ask"."target_text") <= 160);--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_target_company_length" CHECK (char_length("ask"."target_company") <= 120);--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_title_length" CHECK (char_length("ask"."title") between 1 and 500);--> statement-breakpoint
ALTER TABLE "ask_answer" ADD CONSTRAINT "ask_answer_kind_known" CHECK ("ask_answer"."kind" in ('answer', 'know_someone', 'done_myself'));--> statement-breakpoint
ALTER TABLE "ask_helper" ADD CONSTRAINT "ask_helper_warmth_known" CHECK ("ask_helper"."warmth" is null or "ask_helper"."warmth" in ('close', 'knows', 'met'));