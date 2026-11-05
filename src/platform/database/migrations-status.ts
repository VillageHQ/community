import { max } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { bigint, pgTable, serial, text } from "drizzle-orm/pg-core";

import migrationJournal from "../../../drizzle/meta/_journal.json" with { type: "json" };

const drizzleMigrations = pgTable("__drizzle_migrations", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
});

const LATEST_MIGRATION_TIMESTAMP = Math.max(...migrationJournal.entries.map(({ when }) => when));

export async function areMigrationsApplied(database: NodePgDatabase) {
  try {
    const [latest] = await database
      .select({ createdAt: max(drizzleMigrations.createdAt) })
      .from(drizzleMigrations);
    return (latest?.createdAt ?? 0) >= LATEST_MIGRATION_TIMESTAMP;
  } catch {
    return false;
  }
}
