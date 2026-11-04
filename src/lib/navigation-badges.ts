import "server-only";

import type { Database } from "../database/client.ts";
import { readSetupProgress } from "./admin-setup.ts";
import type { Environment } from "./environment.ts";
import type { NavigationBadgeCounts } from "./navigation.ts";
import { readPendingLinkCount } from "./village/network-progress.ts";

export async function readNavigationBadges(database: Database, environment: Environment): Promise<NavigationBadgeCounts> {
  const [{ stepsLeft }, pendingLinks] = await Promise.all([
    readSetupProgress(database, environment),
    readPendingLinkCount(database),
  ]);
  return { admin: stepsLeft + pendingLinks };
}
