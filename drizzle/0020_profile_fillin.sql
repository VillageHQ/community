CREATE TABLE "village_monthly_usage" (
	"usage_month" text PRIMARY KEY NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"fill_in_credits" integer DEFAULT 0 NOT NULL,
	"warned_near_cap_at" timestamp with time zone,
	"warned_at_cap_at" timestamp with time zone,
	CONSTRAINT "village_monthly_usage_month" CHECK ("village_monthly_usage"."usage_month" ~ '^[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "village_monthly_usage_credits" CHECK ("village_monthly_usage"."credits" >= 0 and "village_monthly_usage"."fill_in_credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "member_fill_in" (
	"user_id" text NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"filled_at" timestamp with time zone NOT NULL,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "member_fill_in_user_id_field_pk" PRIMARY KEY("user_id","field"),
	CONSTRAINT "member_fill_in_field" CHECK ("member_fill_in"."field" in ('title', 'company', 'location', 'headline', 'face', 'company_logo'))
);
--> statement-breakpoint
CREATE TABLE "member_lookup" (
	"user_id" text PRIMARY KEY NOT NULL,
	"consented_at" timestamp with time zone,
	"refused_at" timestamp with time zone,
	"status" text,
	"looked_up_at" timestamp with time zone,
	"linkedin_url" text,
	CONSTRAINT "member_lookup_status" CHECK ("member_lookup"."status" is null or "member_lookup"."status" in ('found', 'not_found', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "member_connect_nudge" (
	"user_id" text PRIMARY KEY NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_fill_in" ADD CONSTRAINT "member_fill_in_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_lookup" ADD CONSTRAINT "member_lookup_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_connect_nudge" ADD CONSTRAINT "member_connect_nudge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_lookup_looked_up_at_idx" ON "member_lookup" USING btree ("looked_up_at");