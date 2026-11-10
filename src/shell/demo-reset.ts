import "server-only";

import { inArray, sql } from "drizzle-orm";

import type { Database, Transaction } from "@/platform/database/client";
import { DEMO_GUARD, DEMO_REFUSAL_MESSAGE, readDemoGuard } from "@/platform/demo/guard";
import { isDemoMode } from "@/platform/demo/mode";
import type { Environment } from "@/platform/environment";
import type { ScheduledJob } from "@/platform/jobs/runner";
import { readSettings } from "@/platform/settings/store";
import { INSTANCE_SETTING_KEYS, instanceSettings } from "@/platform/settings/schema";
import { seedDemo } from "./demo-seed";

// The demo's start check and its nightly reset. Both refuse unless DEMO_MODE=true, and the reset erases every app
// table, so it re-checks inside its own transaction that this database is one the demo seeded.

const MINUTE_MS = 60_000;
const RESET_HOUR_UTC = 4;
// Kept through a reset: the migrations record, the job leases (the reset runs under one), and two settings whose
// change would sign everyone out or break the self-tick.
const KEPT_TABLES = ["__drizzle_migrations", "job_lease"];
const KEPT_SETTINGS = [INSTANCE_SETTING_KEYS.authSecret, INSTANCE_SETTING_KEYS.jobsTickSecret];

export const DEMO_RESET_JOB_NAME = "demo-reset";

export class DemoRefusedError extends Error {
  constructor() {
    super(DEMO_REFUSAL_MESSAGE);
    this.name = "DemoRefusedError";
  }
}

async function emptyAppTables(transaction: Transaction) {
  const tables = await transaction.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = current_schema() and tablename not in (${sql.join(KEPT_TABLES.map((name) => sql`${name}`), sql`, `)})`,
  );
  const names = tables.rows.map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`);
  if (names.length > 0) await transaction.execute(sql.raw(`truncate table ${names.join(", ")} restart identity cascade`));
}

// Empties the database and seeds the demo again, in one transaction: a failure leaves yesterday's demo in place.
export async function resetDemo(database: Database, environment: Environment, now = new Date()) {
  if (!isDemoMode(environment)) throw new Error("The demo reset only runs with DEMO_MODE=true.");
  return database.transaction(async (transaction) => {
    if ((await readDemoGuard(transaction)) === DEMO_GUARD.refused) throw new DemoRefusedError();
    const kept = await transaction.select().from(instanceSettings).where(inArray(instanceSettings.key, KEPT_SETTINGS));
    await emptyAppTables(transaction);
    if (kept.length > 0) await transaction.insert(instanceSettings).values(kept);
    return seedDemo(transaction, environment, now);
  });
}

export type DemoStart = { outcome: "off" } | { outcome: "refused"; message: string } | { outcome: "seeded" | "ready" };

// At start: refuse a database with real members, seed an empty one, and leave a seeded one as it is.
export async function startDemo(database: Database, environment: Environment): Promise<DemoStart> {
  if (!isDemoMode(environment)) return { outcome: "off" };
  const guard = await readDemoGuard(database);
  if (guard === DEMO_GUARD.refused) return { outcome: "refused", message: DEMO_REFUSAL_MESSAGE };
  if (guard === DEMO_GUARD.demo) return { outcome: "ready" };
  await database.transaction(async (transaction) => {
    // Another instance may have seeded it a moment ago.
    if ((await readDemoGuard(transaction)) !== DEMO_GUARD.empty) return;
    await seedDemo(transaction, environment);
  });
  return { outcome: "seeded" };
}

// At boot (instrumentation). A real install must never run as a demo, because its nightly reset would erase it:
// on a refusal the server stops, with the reason in plain words.
export async function bootDemo(database: Database, environment: Environment) {
  const started = await startDemo(database, environment);
  if (started.outcome === "seeded") console.log("Demo mode: filled the empty database with the made-up community.");
  if (started.outcome !== "refused") return;
  console.error(started.message);
  process.exit(1);
}

// The most recent 04:00 UTC at or before `now`.
export function readLastResetBoundary(now: Date) {
  const boundary = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RESET_HOUR_UTC));
  return boundary.getTime() > now.getTime() ? new Date(boundary.getTime() - 24 * 60 * MINUTE_MS) : boundary;
}

export async function runNightlyDemoReset(database: Database, environment: Environment, now = new Date()) {
  if (!isDemoMode(environment)) return { isReset: false };
  const settings = await readSettings(database, [INSTANCE_SETTING_KEYS.demoResetAt]);
  const lastResetAt = new Date(settings.get(INSTANCE_SETTING_KEYS.demoResetAt) ?? 0);
  if (lastResetAt.getTime() >= readLastResetBoundary(now).getTime()) return { isReset: false };
  await resetDemo(database, environment, now);
  return { isReset: true };
}

// Checked every 15 minutes; it resets once a night, after 04:00 UTC.
export const DEMO_RESET_JOB: ScheduledJob = {
  name: DEMO_RESET_JOB_NAME,
  intervalMs: 15 * MINUTE_MS,
  run: (database, environment) => runNightlyDemoReset(database, environment),
};
