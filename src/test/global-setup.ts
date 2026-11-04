import { sql } from "drizzle-orm";

import { createDatabase } from "../database/client.ts";
import { runMigrations } from "../database/run-migrations.ts";

export async function setup() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Set TEST_DATABASE_URL to a disposable database.");

  const database = createDatabase(connectionString, {});
  await database.execute(sql`drop schema if exists public cascade`);
  await database.execute(sql`create schema public`);
  await database.$client.end();

  await runMigrations(connectionString, {});
}
