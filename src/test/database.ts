import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { rateLimit, user } from "../database/auth-schema.ts";
import { communityBranding } from "../database/branding-schema.ts";
import { createDatabase, type Database } from "../database/client.ts";
import { instanceSettings } from "../database/instance-settings.ts";

export function readTestConnectionString() {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("Set TEST_DATABASE_URL to a disposable database.");
  return connectionString;
}

export function createTestDatabase() {
  return createDatabase(readTestConnectionString(), {});
}

export async function clearDatabase(database: Database) {
  await database.delete(rateLimit);
  await database.delete(user);
  await database.delete(instanceSettings);
  await database.delete(communityBranding);
}

export async function createDisposableDatabase() {
  const administration = createTestDatabase();
  const name = `disposable_${randomUUID().replaceAll("-", "")}`;
  await administration.execute(sql`create database ${sql.identifier(name)}`);

  const url = new URL(readTestConnectionString());
  url.pathname = `/${name}`;

  return {
    connectionString: url.toString(),
    destroy: async () => {
      await administration.execute(sql`drop database ${sql.identifier(name)} with (force)`);
      await administration.$client.end();
    },
  };
}
