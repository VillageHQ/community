ALTER TABLE "ask" ADD COLUMN "pinned_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "ask" ADD COLUMN "pinned_by_user_id" text;--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_pinned_by_user_id_user_id_fk" FOREIGN KEY ("pinned_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ask" ADD CONSTRAINT "ask_pinned_only_open" CHECK ("ask"."pinned_at" is null or "ask"."closed_at" is null);