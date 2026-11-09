import "server-only";

import { MODULES } from "@/modules/registry";
import type { Database } from "@/platform/database/client";
import { PLATFORM_JOBS } from "@/platform/jobs/platform-jobs";
import type { ScheduledJob } from "@/platform/jobs/runner";
import { readEnabledIds } from "./enabled-modules";

// The platform's jobs always run. A module's jobs run only while the module is on.
export async function readScheduledJobs(database: Database): Promise<ScheduledJob[]> {
  const enabledIds = await readEnabledIds(database);
  const moduleJobs = MODULES.flatMap(({ manifest, jobs }) => (jobs && enabledIds.has(manifest.id) ? jobs : []));
  return [...PLATFORM_JOBS, ...moduleJobs];
}
