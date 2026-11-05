import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { messagesManifest } from "./manifest";
import { readUnreadCount } from "./reads";

export const messagesModule: ModuleIntegration = {
  manifest: messagesManifest,
  readNavigationBadge: readUnreadCount,
};
