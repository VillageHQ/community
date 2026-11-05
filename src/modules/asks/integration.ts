import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { asksManifest } from "./manifest";
import { readNewOfferCount } from "./reads";
import { deleteMemberAsks, withdrawOffersBetween } from "./service";

export const asksModule: ModuleIntegration = {
  manifest: asksManifest,
  readNavigationBadge: readNewOfferCount,
  onMemberBlocked: withdrawOffersBetween,
  onMemberRemoved: async (transaction, removal) => {
    if (!removal.keepsContent) await deleteMemberAsks(transaction, removal);
  },
};
