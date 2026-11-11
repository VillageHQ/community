CREATE TABLE "village_check" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"checked_at" timestamp with time zone,
	"keys" text,
	"group_state" text,
	"group_member_count" integer,
	"checked_by_id" text
);
--> statement-breakpoint
CREATE TABLE "village_member_check" (
	"user_id" text PRIMARY KEY NOT NULL,
	"outcome" text NOT NULL,
	"is_provisioned" boolean DEFAULT false NOT NULL,
	"network_status" text,
	"is_in_group" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "village_check" ADD CONSTRAINT "village_check_checked_by_id_user_id_fk" FOREIGN KEY ("checked_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "village_member_check" ADD CONSTRAINT "village_member_check_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;