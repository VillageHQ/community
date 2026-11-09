import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { networkManifest } from "./manifest";
import { FILL_IN_JOB_NAME, FILL_IN_LEASE_MS, runFillIn } from "./service-fill-in";

const HOUR_MS = 60 * 60_000;
// The fill-in runs at night, from 02:00 to 05:59 UTC, checked every hour. A run finds only members
// who are due, so the later hours cost nothing once the first has run, and an admin's run just
// before 02:00 can't make the night skip.
const NIGHT_STARTS_UTC = 2;
const NIGHT_ENDS_UTC = 6;

export function isFillInHour(now = new Date()) {
  const hour = now.getUTCHours();
  return hour >= NIGHT_STARTS_UTC && hour < NIGHT_ENDS_UTC;
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
