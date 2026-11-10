import "server-only";

import type { Database } from "../platform/database/client.ts";
import type { Environment } from "../platform/environment.ts";
import { networkManifest } from "../modules/network/manifest.ts";
import { MODULES } from "../modules/registry.ts";
import { readSetupProgress } from "./admin-setup.ts";
import { readEnabledIds } from "./enabled-modules.ts";
import { readConfirmationBadgeCount } from "../modules/members/service-admin.ts";
import { readPendingLinkCount } from "../modules/network/reads-progress.ts";
import { readVillageHealth } from "../platform/village/health.ts";
import { readVillageOutOfCreditsAt } from "../platform/village/settings.ts";
import { readOpenReportCount } from "../modules/admin/service-reports.ts";
import { chatManifest } from "../modules/chat/manifest.ts";
import { readChatConnections } from "../modules/chat/service.ts";

export async function readAdminTabFacts(database: Database, environment: Environment) {
  const enabledIds = await readEnabledIds(database);
  const isNetworkOn = enabledIds.has(networkManifest.id);
  const isChatOn = enabledIds.has(chatManifest.id);
  const [{ isComplete, stepsLeft }, confirmations, pendingLinks, openReports, outOfCreditsAt, villageHealth, chatConnections] = await Promise.all([
    readSetupProgress(database),
    readConfirmationBadgeCount(database, environment),
    isNetworkOn ? readPendingLinkCount(database) : 0,
    readOpenReportCount(database),
    isNetworkOn ? readVillageOutOfCreditsAt(database) : null,
    isNetworkOn ? readVillageHealth(database) : null,
    isChatOn ? readChatConnections(database) : [],
  ]);
  return {
    isSetupComplete: isComplete,
    setupStepsLeft: stepsLeft,
    membersBadge: confirmations + pendingLinks,
    reportsBadge: openReports,
    creditsBadge: outOfCreditsAt || villageHealth?.trouble ? 1 : 0,
    // Village didn't answer or refused the keys: every admin page says so, with when it last worked.
    villageTrouble: villageHealth?.trouble ? villageHealth : null,
    chatBadge: chatConnections.filter(({ needsAttention }) => needsAttention).length,
    hiddenTabHrefs: MODULES.flatMap(({ manifest }) => (enabledIds.has(manifest.id) ? [] : manifest.adminTabs.map(({ href }) => href))),
  };
}

export type AdminTabFacts = Awaited<ReturnType<typeof readAdminTabFacts>>;
