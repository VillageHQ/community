CREATE TABLE "chat_connection" (
	"kind" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"signing_secret" text,
	"account_id" text,
	"account_name" text,
	"channel_id" text,
	"channel_name" text,
	"is_paused" boolean DEFAULT false NOT NULL,
	"is_refused" boolean DEFAULT false NOT NULL,
	"last_post_at" timestamp (3) with time zone,
	"last_error" text,
	"last_error_at" timestamp (3) with time zone,
	"connected_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"posts_from_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_connection_kind_known" CHECK ("chat_connection"."kind" in ('slack', 'discord'))
);
--> statement-breakpoint
CREATE TABLE "chat_post" (
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"status" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_post_kind_ref_pk" PRIMARY KEY("kind","ref"),
	CONSTRAINT "chat_post_status_known" CHECK ("chat_post"."status" in ('sending', 'sent', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "chat_post" ADD CONSTRAINT "chat_post_kind_chat_connection_kind_fk" FOREIGN KEY ("kind") REFERENCES "public"."chat_connection"("kind") ON DELETE cascade ON UPDATE no action;