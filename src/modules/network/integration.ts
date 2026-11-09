import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { networkManifest } from "./manifest";
import { FILL_IN_JOB_NAME, FILL_IN_LEASE_MS, runFillIn } from "./service-fill-in";

const HOUR_MS = 60 * 60_000;
// The fill-in runs once a night, in the hour after 02:00 UTC. The job is checked every hour, so a
// server that was asleep at 02:00 simply waits for the next night.
const NIGHTLY_HOUR_UTC = 2;

export function isFillInHour(now = new Date()) {
  return now.getUTCHours() === NIGHTLY_HOUR_UTC;
}

export const networkModule: ModuleIntegration = {
  manifest: networkManifest,
  jobs: [
    {
      name: FILL_IN_JOB_NAME,
      intervalMs: HOUR_MS,
      leaseMs: FILL_IN_LEASE_MS,
      run: async (database, environment) => (isFillInHour() ? runFillIn(database, environment) : null),
    },
  ],
};
