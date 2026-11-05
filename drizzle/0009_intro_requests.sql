CREATE TABLE "intro_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" text NOT NULL,
	"introducer_id" text NOT NULL,
	"target_linkedin_slug" text NOT NULL,
	"target_name" text NOT NULL,
	"target_headline" text,
	"introducer_name" text NOT NULL,
	"introducer_headline" text,
	"introducer_linkedin_slug" text NOT NULL,
	"reason" text NOT NULL,
	"note" text NOT NULL,
	"state" text DEFAULT 'requested' NOT NULL,
	"decline_reason" text,
	"is_withheld" boolean DEFAULT false NOT NULL,
	"requester_has_update" boolean DEFAULT false NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp (3) with time zone,
	"closed_at" timestamp (3) with time zone,
	"expires_at" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "intro_request_state_known" CHECK ("intro_request"."state" in ('requested', 'accepted', 'declined', 'withdrawn', 'completed', 'expired')),
	CONSTRAINT "intro_request_not_self" CHECK ("intro_request"."requester_id" <> "intro_request"."introducer_id"),
	CONSTRAINT "intro_request_note_length" CHECK (char_length("intro_request"."note") between 1 and 1000),
	CONSTRAINT "intro_request_decline_reason" CHECK ("intro_request"."decline_reason" is null or ("intro_request"."state" = 'declined' and char_length("intro_request"."decline_reason") between 1 and 500)),
	CONSTRAINT "intro_request_snapshot_lengths" CHECK (char_length("intro_request"."target_name") between 1 and 200 and char_length("intro_request"."introducer_name") between 1 and 200 and char_length("intro_request"."reason") between 1 and 600)
);
--> statement-breakpoint
ALTER TABLE "intro_request" ADD CONSTRAINT "intro_request_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intro_request" ADD CONSTRAINT "intro_request_introducer_id_user_id_fk" FOREIGN KEY ("introducer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "intro_request_open_unique" ON "intro_request" USING btree ("requester_id","introducer_id","target_linkedin_slug") WHERE "intro_request"."state" in ('requested', 'accepted');--> statement-breakpoint
CREATE INDEX "intro_request_requester_created_idx" ON "intro_request" USING btree ("requester_id","created_at");--> statement-breakpoint
CREATE INDEX "intro_request_introducer_created_idx" ON "intro_request" USING btree ("introducer_id","created_at");