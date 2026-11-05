import "server-only";

import type { Database } from "../../platform/database/client.ts";
import type { Environment } from "../../platform/environment.ts";
import { readSetupProgress } from "../admin-setup.ts";
import { readConfirmationBadgeCount } from "../members/member-admin.ts";
import { readPendingLinkCount } from "../village/network-progress.ts";
import { readVillageOutOfCreditsAt } from "../village/settings.ts";
import { readOpenReportCount } from "./reports.ts";

export async function readAdminTabFacts(database: Database, environment: Environment) {
  const [{ isComplete, stepsLeft }, confirmations, pendingLinks, openReports, outOfCreditsAt] = await Promise.all([
    readSetupProgress(database, environment),
    readConfirmationBadgeCount(database, environment),
    readPendingLinkCount(database),
    readOpenReportCount(database),
    readVillageOutOfCreditsAt(database),
  ]);
  return {
    isSetupComplete: isComplete,
    setupStepsLeft: stepsLeft,
    membersBadge: confirmations + pendingLinks,
    reportsBadge: openReports,
    creditsBadge: outOfCreditsAt ? 1 : 0,
  };
}

export type AdminTabFacts = Awaited<ReturnType<typeof readAdminTabFacts>>;
