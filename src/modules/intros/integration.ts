import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { introsManifest } from "./manifest";
import { readIntroBadgeCount, readIntroCounts } from "./reads";
import { stopOpenAsksOnBlock } from "./service-blocks";

export const introsModule: ModuleIntegration = {
  manifest: introsManifest,
  readNavigationBadge: async (database, memberId) => readIntroBadgeCount(await readIntroCounts(database, memberId)),
  onMemberBlocked: stopOpenAsksOnBlock,
};
