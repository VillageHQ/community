ALTER TABLE "member_removal" ADD COLUMN "village_leave_outcome" text;--> statement-breakpoint
ALTER TABLE "member_daily_usage" ADD COLUMN "search_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "member_network" ADD COLUMN "stale_group_external_id" uuid;