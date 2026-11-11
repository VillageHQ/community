CREATE TABLE "village_credit_call" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"credits" integer NOT NULL,
	"user_id" text,
	"called_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "village_credit_call" ADD CONSTRAINT "village_credit_call_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "village_credit_call_called_at" ON "village_credit_call" USING btree ("called_at");