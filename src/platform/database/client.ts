import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Environment } from "../environment.ts";
import { logError } from "../observability/route-logging.ts";
import { createConnectionConfig } from "./connection-config.ts";

const POOL_SIZE = 5;
const QUERY_TIMEOUT_MS = 10_000;
const TRANSACTION_POOLER_HOST_MARKER = "-pooler";

function isBehindTransactionPooler(connectionString: string, environment: Environment) {
  if (environment.DATABASE_URL_UNPOOLED) return true;
  return new URL(connectionString).hostname.includes(TRANSACTION_POOLER_HOST_MARKER);
}

// PgBouncer rejects statement_timeout as a startup parameter unless configured to ignore it.
export function createPoolConfig(connectionString: string, environment: Environment) {
  const timeouts = isBehindTransactionPooler(connectionString, environment)
    ? { query_timeout: QUERY_TIMEOUT_MS }
    : { query_timeout: QUERY_TIMEOUT_MS, statement_timeout: QUERY_TIMEOUT_MS };

  return {
    ...createConnectionConfig(connectionString, environment),
    ...timeouts,
    max: POOL_SIZE,
  };
}

export function createDatabase(connectionString: string, environment: Environment) {
  const pool = new Pool(createPoolConfig(connectionString, environment));
  pool.on("error", (error) => logError("database-pool", error));
  return drizzle({ client: pool });
}

export type Database = ReturnType<typeof createDatabase>;

let sharedDatabase: Database | undefined;

export function getDatabase() {
  if (sharedDatabase) return sharedDatabase;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");

  sharedDatabase = createDatabase(connectionString, process.env);
  return sharedDatabase;
}

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DatabaseOrTransaction = Database | Transaction;
