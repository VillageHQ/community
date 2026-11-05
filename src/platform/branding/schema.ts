import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { bytea } from "../database/bytea.ts";
import { DEFAULT_ACCENT_COLOR } from "../design/accent.ts";
import { LOGO_BACKDROPS, MAXIMUM_LOGO_BYTES } from "./logo-rules.ts";

export const DEFAULT_COMMUNITY_NAME = "Your community";

export const communityBranding = pgTable(
  "community_branding",
  {
    isSingleton: boolean("is_singleton").primaryKey().default(true),
    name: text("name").notNull().default(DEFAULT_COMMUNITY_NAME),
    descriptor: text("descriptor").notNull().default(""),
    accentColor: text("accent_color").notNull().default(DEFAULT_ACCENT_COLOR),
    savedAt: timestamp("saved_at", { withTimezone: true }),
    logoBytes: bytea("logo_bytes"),
    logoContentType: text("logo_content_type"),
    logoBackdrop: text("logo_backdrop").notNull().default(LOGO_BACKDROPS.light),
    logoUpdatedAt: timestamp("logo_updated_at", { withTimezone: true }),
  },
  (table) => [
    check("community_branding_is_singleton", sql`${table.isSingleton}`),
    check("community_branding_accent_color", sql`${table.accentColor} ~ '^#[0-9a-f]{6}$'`),
    check(
      "community_branding_logo_size",
      sql`octet_length(${table.logoBytes}) <= ${sql.raw(String(MAXIMUM_LOGO_BYTES))}`,
    ),
    check("community_branding_logo_backdrop", sql`${table.logoBackdrop} in ('light', 'dark')`),
    check(
      "community_branding_logo_type",
      sql`${table.logoContentType} in ('image/png', 'image/jpeg', 'image/webp')`,
    ),
  ],
);
