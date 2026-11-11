import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import { SOURCE_TOOLS } from "./contract.ts";

const MILLISECOND_PRECISION = 3;

function jobTimestamp(name: string) {
  return timestamp(name, { withTimezone: true, precision: MILLISECOND_PRECISION });
}

const TOOL_LIST = sql.raw(SOURCE_TOOLS.map((tool) => `'${tool}'`).join(", "));

// A company's hiring tool, linked by one member. A source with tool "manual" has only jobs added by hand.
export const jobSource = pgTable(
  "job_source",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    companySlug: text("company_slug").notNull(),
    tool: text("tool").notNull(),
    // The board's name in the tool. Null for "manual".
    slug: text("slug"),
    sourceUrl: text("source_url"),
    hidden: boolean("hidden").notNull().default(false),
    // Hidden by an admin: only an admin shows it again.
    hiddenByAdmin: boolean("hidden_by_admin").notNull().default(false),
    lastPulledAt: jobTimestamp("last_pulled_at"),
    // The last pull's problem in plain words. Null after a pull that worked.
    lastError: text("last_error"),
    createdAt: jobTimestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("job_source_member_idx").on(table.memberId),
    index("job_source_company_slug_idx").on(table.companySlug),
    check("job_source_tool_known", sql`${table.tool} in (${TOOL_LIST})`),
    check("job_source_admin_hide_is_hidden", sql`not ${table.hiddenByAdmin} or ${table.hidden}`),
    check("job_source_feed_has_slug", sql`(${table.tool} = 'manual') = (${table.slug} is null)`),
  ],
);

export const jobPosting = pgTable(
  "job_posting",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => jobSource.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    location: text("location").notNull().default(""),
    department: text("department").notNull().default(""),
    url: text("url").notNull().default(""),
    postedAt: jobTimestamp("posted_at"),
    // Added by hand: a pull never removes it.
    isManual: boolean("is_manual").notNull().default(false),
    // When this job first appeared here. A pull keeps it, so Today can tell a new job from one seen before.
    firstSeenAt: jobTimestamp("first_seen_at").notNull().defaultNow(),
    updatedAt: jobTimestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique("job_posting_source_external_unique").on(table.sourceId, table.externalId), index("job_posting_source_idx").on(table.sourceId)],
);
