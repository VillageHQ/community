import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { introsManifest } from "./manifest";
import { expireDueIntros, readIntroBadgeCount, readIntroCounts } from "./reads";
import { stopOpenAsksOnBlock } from "./service-blocks";

export const introsModule: ModuleIntegration = {
  manifest: introsManifest,
  readNavigationBadge: async (database, memberId) => readIntroBadgeCount(await readIntroCounts(database, memberId)),
  onMemberBlocked: stopOpenAsksOnBlock,
  jobs: [{ name: "intro-expiry", intervalMs: 15 * 60_000, run: (database) => expireDueIntros(database, null) }],
};
