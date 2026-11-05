import { join } from "node:path";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

import type { Environment } from "../environment.ts";
import { logError } from "../observability/route-logging.ts";
import { createConnectionConfig } from "./connection-config.ts";
import { areMigrationsApplied } from "./migrations-status.ts";

const MIGRATIONS_FOLDER_NAME = "drizzle";
const MIGRATIONS_SCHEMA = "public";
const MIGRATION_LOCK_ID = 7_260_411;
const MIGRATION_QUERY_TIMEOUT_MS = 120_000;
const CREATE_MIGRATIONS_SCHEMA_STATEMENT = `CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`;

function isMigrationsSchemaCreation(query: unknown) {
  return (
    typeof query === "object" &&
    query !== null &&
    "text" in query &&
    query.text === CREATE_MIGRATIONS_SCHEMA_STATEMENT
  );
}

// Postgres checks CREATE on the database before honoring IF NOT EXISTS, and restricted roles such
// as DigitalOcean dev database users lack it, so migrate() would fail on a schema that exists.
function skipMigrationsSchemaCreation(client: Client) {
  return new Proxy(client, {
    get(target, property) {
      const value = Reflect.get(target, property, target);
      if (property !== "query") return typeof value === "function" ? value.bind(target) : value;

      return (...queryArguments: unknown[]) =>
        isMigrationsSchemaCreation(queryArguments[0])
          ? Promise.resolve({ rows: [] })
          : Reflect.apply(value, target, queryArguments);
    },
  });
}

export async function runMigrations(connectionString: string, environment: Environment) {
  const client = new Client({
    ...createConnectionConfig(connectionString, environment),
    query_timeout: MIGRATION_QUERY_TIMEOUT_MS,
  });
  client.on("error", (error) => logError("migrations", error));
  await client.connect();

  try {
    const database = drizzle({ client: skipMigrationsSchemaCreation(client) });
    if (await areMigrationsApplied(database)) return { migrated: false };

    await database.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK_ID})`);
    await migrate(database, {
      migrationsFolder: join(process.cwd(), MIGRATIONS_FOLDER_NAME),
      migrationsSchema: MIGRATIONS_SCHEMA,
    });
    return { migrated: true };
  } finally {
    await client.end();
  }
}
