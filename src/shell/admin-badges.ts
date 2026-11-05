import "server-only";

import type { Database } from "../platform/database/client.ts";
import type { Environment } from "../platform/environment.ts";
import { networkManifest } from "../modules/network/manifest.ts";
import { MODULES } from "../modules/registry.ts";
import { readSetupProgress } from "./admin-setup.ts";
import { readEnabledIds } from "./enabled-modules.ts";
import { readConfirmationBadgeCount } from "../modules/members/service-admin.ts";
import { readPendingLinkCount } from "../modules/network/reads-progress.ts";
import { readVillageOutOfCreditsAt } from "../platform/village/settings.ts";
import { readOpenReportCount } from "../modules/admin/service-reports.ts";

export async function readAdminTabFacts(database: Database, environment: Environment) {
  const enabledIds = await readEnabledIds(database);
  const isNetworkOn = enabledIds.has(networkManifest.id);
  const [{ isComplete, stepsLeft }, confirmations, pendingLinks, openReports, outOfCreditsAt] = await Promise.all([
    readSetupProgress(database, environment),
    readConfirmationBadgeCount(database, environment),
    isNetworkOn ? readPendingLinkCount(database) : 0,
    readOpenReportCount(database),
    isNetworkOn ? readVillageOutOfCreditsAt(database) : null,
  ]);
  return {
    isSetupComplete: isComplete,
    setupStepsLeft: stepsLeft,
    membersBadge: confirmations + pendingLinks,
    reportsBadge: openReports,
    creditsBadge: outOfCreditsAt ? 1 : 0,
    hiddenTabHrefs: MODULES.flatMap(({ manifest }) => (enabledIds.has(manifest.id) ? [] : manifest.adminTabs.map(({ href }) => href))),
  };
}

export type AdminTabFacts = Awaited<ReturnType<typeof readAdminTabFacts>>;
