CREATE TABLE "member_daily_usage" (
	"user_id" text NOT NULL,
	"usage_date" date NOT NULL,
	"call_count" integer NOT NULL,
	CONSTRAINT "member_daily_usage_user_id_usage_date_pk" PRIMARY KEY("user_id","usage_date")
);
--> statement-breakpoint
CREATE TABLE "member_network" (
	"user_id" text PRIMARY KEY NOT NULL,
	"village_external_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"linkedin_slug" text,
	"sharing_consented_at" timestamp with time zone,
	"group_joined_at" timestamp with time zone,
	CONSTRAINT "member_network_village_external_id_unique" UNIQUE("village_external_id"),
	CONSTRAINT "member_network_linkedin_slug_unique" UNIQUE("linkedin_slug")
);
--> statement-breakpoint
CREATE TABLE "member_path_result" (
	"user_id" text NOT NULL,
	"linkedin_slug" text NOT NULL,
	"paths" jsonb,
	"fetched_at" timestamp with time zone NOT NULL,
	CONSTRAINT "member_path_result_user_id_linkedin_slug_pk" PRIMARY KEY("user_id","linkedin_slug")
);
--> statement-breakpoint
ALTER TABLE "member_daily_usage" ADD CONSTRAINT "member_daily_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_network" ADD CONSTRAINT "member_network_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_path_result" ADD CONSTRAINT "member_path_result_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;