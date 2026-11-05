import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { feedManifest } from "./manifest";
import { deleteMemberContent } from "./service";

export const feedModule: ModuleIntegration = {
  manifest: feedManifest,
  onMemberRemoved: async (transaction, { memberId, memberName, actorId, keepsContent }) => {
    if (!keepsContent) await deleteMemberContent(transaction, { id: memberId, name: memberName }, actorId);
  },
};
