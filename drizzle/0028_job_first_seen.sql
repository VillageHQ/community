ALTER TABLE "job_posting" ADD COLUMN "first_seen_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Jobs already here were first seen no later than their source was linked, so they are not all "new this week".
UPDATE "job_posting" SET "first_seen_at" = "job_source"."created_at" FROM "job_source" WHERE "job_source"."id" = "job_posting"."source_id";
