CREATE TABLE "ask_answer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ask_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_answer_one_per_member" UNIQUE("ask_id","author_id"),
	CONSTRAINT "ask_answer_body_length" CHECK (char_length("ask_answer"."body") between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "ask_helper" (
	"ask_id" uuid NOT NULL,
	"helper_id" text NOT NULL,
	"reason" text NOT NULL,
	"why" text NOT NULL,
	"connector_slug" text,
	"notified_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_helper_ask_id_helper_id_pk" PRIMARY KEY("ask_id","helper_id"),
	CONSTRAINT "ask_helper_reason_known" CHECK ("ask_helper"."reason" in ('path', 'words'))
);
--> statement-breakpoint
ALTER TABLE "content_report" DROP CONSTRAINT "content_report_target_known";--> statement-breakpoint
ALTER TABLE "ask" ADD COLUMN "kind" text DEFAULT 'ask' NOT NULL;--> statement-breakpoint
ALTER TABLE "ask" ADD COLUMN "target_slug" text;--> statement-breakpoint
ALTER TABLE "ask" ADD COLUMN "target_name" text;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "ask_id" uuid;--> statement-breakpoint
ALTER TABLE "intro_request" ADD COLUMN "is_connector_offer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ask_answer" ADD CONSTRAINT "ask_answer_ask_id_ask_id_fk" FOREIGN KEY ("ask_id") REFERENCES "public"."ask"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_answer" ADD CONSTRAINT "ask_answer_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_helper" ADD CONSTRAINT "ask_helper_ask_id_ask_id_fk" FOREIGN KEY ("ask_id") REFERENCES "public"."ask"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_helper" ADD CONSTRAINT "ask_helper_helper_id_user_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_answer_author_id_idx" ON "ask_answer" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "ask_helper_helper_id_idx" ON "ask_helper" USING btree ("helper_id");--> statement-breakpoint
CREATE INDEX "ask_author_created_idx" ON "ask" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "intro_request_ask_id_idx" ON "intro_request" USING btree ("ask_id") WHERE "intro_request"."ask_id" is not null;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_target_known" CHECK ("content_report"."target_type" in ('post', 'comment', 'intro_note', 'ask', 'ask_answer'));--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_kind_known" CHECK ("ask"."kind" in ('ask', 'update'));--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_target_only_on_asks" CHECK ("ask"."target_slug" is null or "ask"."kind" = 'ask');--> statement-breakpoint
-- Asks now starts on for new communities. A community that already has members keeps it as it was: off, unless an
-- admin turned it on.
INSERT INTO "instance_settings" ("key", "value") SELECT 'module_state:asks', 'off' WHERE EXISTS (SELECT 1 FROM "user") ON CONFLICT ("key") DO NOTHING;
