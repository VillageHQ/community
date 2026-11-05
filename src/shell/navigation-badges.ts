import "server-only";

import type { Database } from "../platform/database/client.ts";
import { readOpenReportCount } from "../modules/admin/service-reports.ts";
import { readSetupProgress } from "./admin-setup.ts";
import type { Environment } from "../platform/environment.ts";
import { readConfirmationBadgeCount } from "../modules/members/service-admin.ts";
import type { NavigationBadgeCounts } from "./navigation.ts";
import { readPendingLinkCount } from "../modules/network/reads-progress.ts";
import { readVillageOutOfCreditsAt } from "../platform/village/settings.ts";

export async function readNavigationBadges(database: Database, environment: Environment): Promise<NavigationBadgeCounts> {
  const [{ stepsLeft }, pendingLinks, waitingConfirmations, openReports, outOfCreditsAt] = await Promise.all([
    readSetupProgress(database, environment),
    readPendingLinkCount(database),
    readConfirmationBadgeCount(database, environment),
    readOpenReportCount(database),
    readVillageOutOfCreditsAt(database),
  ]);
  return { admin: stepsLeft + pendingLinks + waitingConfirmations + openReports + (outOfCreditsAt ? 1 : 0) };
}
