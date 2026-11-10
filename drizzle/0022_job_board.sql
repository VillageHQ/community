CREATE TABLE "job_posting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"posted_at" timestamp (3) with time zone,
	"is_manual" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_posting_source_external_unique" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "job_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" text NOT NULL,
	"company" text NOT NULL,
	"company_slug" text NOT NULL,
	"tool" text NOT NULL,
	"slug" text,
	"source_url" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"last_pulled_at" timestamp (3) with time zone,
	"last_error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_source_tool_known" CHECK ("job_source"."tool" in ('greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'recruitee', 'breezy', 'rippling', 'teamtailor', 'bamboohr', 'personio', 'jobvite', 'manual')),
	CONSTRAINT "job_source_feed_has_slug" CHECK (("job_source"."tool" = 'manual') = ("job_source"."slug" is null))
);
--> statement-breakpoint
ALTER TABLE "job_posting" ADD CONSTRAINT "job_posting_source_id_job_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source" ADD CONSTRAINT "job_source_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_posting_source_idx" ON "job_posting" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "job_source_member_idx" ON "job_source" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "job_source_company_slug_idx" ON "job_source" USING btree ("company_slug");