import "server-only";

import { MODULES } from "@/modules/registry";
import type { Database } from "@/platform/database/client";
import { PLATFORM_JOBS } from "@/platform/jobs/platform-jobs";
import type { ScheduledJob } from "@/platform/jobs/runner";
import { readEnabledIds } from "./enabled-modules";
import { runWeeklyEmails } from "./weekly-email";

const MINUTE_MS = 60_000;

// Jobs that read several modules. The weekly email checks each module itself.
const SHELL_JOBS: readonly ScheduledJob[] = [
  { name: "weekly-email", intervalMs: 5 * MINUTE_MS, leaseMs: 10 * MINUTE_MS, run: (database, environment) => runWeeklyEmails(database, environment) },
];

// The platform's and the shell's jobs always run. A module's jobs run only while the module is on.
export async function readScheduledJobs(database: Database): Promise<ScheduledJob[]> {
  const enabledIds = await readEnabledIds(database);
  const moduleJobs = MODULES.flatMap(({ manifest, jobs }) => (jobs && enabledIds.has(manifest.id) ? jobs : []));
  // The weekly email runs before the outbox sender, so what it queues goes out in the same tick.
  return [...SHELL_JOBS, ...PLATFORM_JOBS, ...moduleJobs];
}
