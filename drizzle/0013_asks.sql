CREATE TABLE "ask" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"category" text NOT NULL,
	"listed_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp (3) with time zone,
	"outcome" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_category_known" CHECK ("ask"."category" in ('intro', 'hire', 'customer', 'advice', 'other')),
	CONSTRAINT "ask_outcome_known" CHECK ("ask"."outcome" in ('solved_here', 'solved_elsewhere', 'no_longer_needed')),
	CONSTRAINT "ask_closed_with_outcome" CHECK (("ask"."closed_at" is null) = ("ask"."outcome" is null)),
	CONSTRAINT "ask_title_length" CHECK (char_length("ask"."title") between 1 and 120),
	CONSTRAINT "ask_detail_length" CHECK (char_length("ask"."detail") between 1 and 1000)
);
--> statement-breakpoint
CREATE TABLE "ask_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ask_id" uuid NOT NULL,
	"helper_id" text NOT NULL,
	"note" text NOT NULL,
	"seen_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ask_offer_one_per_helper" UNIQUE("ask_id","helper_id"),
	CONSTRAINT "ask_offer_note_length" CHECK (char_length("ask_offer"."note") between 1 and 500)
);
--> statement-breakpoint
ALTER TABLE "content_report" DROP CONSTRAINT "content_report_target_known";--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_offer" ADD CONSTRAINT "ask_offer_ask_id_ask_id_fk" FOREIGN KEY ("ask_id") REFERENCES "public"."ask"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask_offer" ADD CONSTRAINT "ask_offer_helper_id_user_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ask_board_idx" ON "ask" USING btree ("listed_at" desc,"id" desc) WHERE "ask"."closed_at" is null;--> statement-breakpoint
CREATE INDEX "ask_author_id_idx" ON "ask" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "ask_offer_helper_id_idx" ON "ask_offer" USING btree ("helper_id");--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_target_known" CHECK ("content_report"."target_type" in ('post', 'comment', 'intro_note', 'ask'));