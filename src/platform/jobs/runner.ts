import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { logError, readErrorReason } from "../observability/route-logging.ts";
import { jobLease } from "./schema.ts";

const DEFAULT_LEASE_MS = 5 * 60_000;
// A job due every minute and ticked every minute must not skip a tick because the last one
// started a few seconds late.
const SCHEDULE_SLACK_MS = 5_000;
const MAXIMUM_ERROR_LENGTH = 300;

export type ScheduledJob = {
  name: string;
  intervalMs: number;
  leaseMs?: number;
  run: (database: Database, environment: Environment) => Promise<unknown>;
};

export const JOB_OUTCOMES = { ran: "ran", failed: "failed", busy: "busy", notDue: "not_due" } as const;

export type JobOutcome = (typeof JOB_OUTCOMES)[keyof typeof JOB_OUTCOMES];

// Next can load this file more than once in one process, so the guard lives on globalThis.
const RUNNING_KEY = Symbol.for("community.jobs.running");
const globalState = globalThis as typeof globalThis & { [RUNNING_KEY]?: Set<string> };
const runningJobs = (globalState[RUNNING_KEY] ??= new Set<string>());

async function acquireLease(database: Database, job: ScheduledJob, holder: string) {
  const leaseMs = job.leaseMs ?? DEFAULT_LEASE_MS;
  const leasedUntil = sql`now() + ${sql.raw(`interval '${Math.ceil(leaseMs / 1000)} seconds'`)}`;
  const dueBefore = sql`now() - ${sql.raw(`interval '${Math.max(0, Math.floor((job.intervalMs - SCHEDULE_SLACK_MS) / 1000))} seconds'`)}`;
  const acquired = await database
    .insert(jobLease)
    .values({ name: job.name, holder, leasedUntil, lastStartedAt: sql`now()` })
    .onConflictDoUpdate({
      target: jobLease.name,
      set: { holder, leasedUntil, lastStartedAt: sql`now()` },
      setWhere: and(
        sql`${jobLease.leasedUntil} <= now()`,
        sql`(${jobLease.lastStartedAt} is null or ${jobLease.lastStartedAt} <= ${dueBefore})`,
      ),
    })
    .returning({ name: jobLease.name });
  return acquired.length > 0;
}

async function releaseLease(database: Database, name: string, holder: string, lastError: string | null) {
  await database
    .update(jobLease)
    .set({ holder: null, leasedUntil: sql`now()`, lastFinishedAt: sql`now()`, lastError })
    .where(and(eq(jobLease.name, name), eq(jobLease.holder, holder)));
}

export async function runJob(database: Database, environment: Environment, job: ScheduledJob): Promise<JobOutcome> {
  if (runningJobs.has(job.name)) return JOB_OUTCOMES.busy;
  runningJobs.add(job.name);
  const holder = randomUUID();
  try {
    if (!(await acquireLease(database, job, holder))) return JOB_OUTCOMES.notDue;
    try {
      await job.run(database, environment);
    } catch (error) {
      logError(`job-${job.name}`, error);
      await releaseLease(database, job.name, holder, readErrorReason(error).slice(0, MAXIMUM_ERROR_LENGTH));
      return JOB_OUTCOMES.failed;
    }
    await releaseLease(database, job.name, holder, null);
    return JOB_OUTCOMES.ran;
  } finally {
    runningJobs.delete(job.name);
  }
}

// Runs every due job one after another. A failing job doesn't stop the others.
export async function runDueJobs(database: Database, environment: Environment, jobs: readonly ScheduledJob[]) {
  const outcomes: Record<string, JobOutcome> = {};
  for (const job of jobs) {
    try {
      outcomes[job.name] = await runJob(database, environment, job);
    } catch (error) {
      logError(`job-${job.name}`, error);
      outcomes[job.name] = JOB_OUTCOMES.failed;
    }
  }
  return outcomes;
}
