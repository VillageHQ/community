import "server-only";

import type { Database } from "../database/client.ts";
import { readSetupProgress } from "./admin-setup.ts";
import type { Environment } from "./environment.ts";
import { readConfirmationBadgeCount } from "./members/member-admin.ts";
import type { NavigationBadgeCounts } from "./navigation.ts";
import { readPendingLinkCount } from "./village/network-progress.ts";

export async function readNavigationBadges(database: Database, environment: Environment): Promise<NavigationBadgeCounts> {
  const [{ stepsLeft }, pendingLinks, waitingConfirmations] = await Promise.all([
    readSetupProgress(database, environment),
    readPendingLinkCount(database),
    readConfirmationBadgeCount(database, environment),
  ]);
  return { admin: stepsLeft + pendingLinks + waitingConfirmations };
}
