CREATE TABLE "community_branding" (
	"is_singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"name" text DEFAULT 'Your community' NOT NULL,
	"descriptor" text DEFAULT '' NOT NULL,
	"accent_color" text DEFAULT '#0f7f86' NOT NULL,
	"saved_at" timestamp with time zone,
	"logo_bytes" "bytea",
	"logo_content_type" text,
	"logo_backdrop" text DEFAULT 'light' NOT NULL,
	"logo_updated_at" timestamp with time zone,
	CONSTRAINT "community_branding_is_singleton" CHECK ("community_branding"."is_singleton"),
	CONSTRAINT "community_branding_accent_color" CHECK ("community_branding"."accent_color" ~ '^#[0-9a-f]{6}$'),
	CONSTRAINT "community_branding_logo_size" CHECK (octet_length("community_branding"."logo_bytes") <= 524288),
	CONSTRAINT "community_branding_logo_backdrop" CHECK ("community_branding"."logo_backdrop" in ('light', 'dark')),
	CONSTRAINT "community_branding_logo_type" CHECK ("community_branding"."logo_content_type" in ('image/png', 'image/jpeg', 'image/webp'))
);
