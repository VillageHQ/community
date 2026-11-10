import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { jobBoardManifest } from "./manifest";
import { pullDueSources } from "./service-pull";

const FIVE_MINUTES_MS = 5 * 60_000;

export const jobBoardModule: ModuleIntegration = {
  manifest: jobBoardManifest,
  // Checks every five minutes; each linked board is pulled at most once an hour.
  jobs: [{ name: "job-board-pull", intervalMs: FIVE_MINUTES_MS, leaseMs: 10 * 60_000, run: pullDueSources }],
};
