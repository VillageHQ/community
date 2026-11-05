import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { adminManifest } from "./admin/manifest";
import { feedModule } from "./feed/integration";
import { introsModule } from "./intros/integration";
import { membersManifest } from "./members/manifest";
import { messagesModule } from "./messages/integration";
import { networkManifest } from "./network/manifest";

// A module adds one line here. The order is the order of the navigation.
export const MODULES: readonly ModuleIntegration[] = [
  feedModule,
  messagesModule,
  { manifest: membersManifest },
  { manifest: networkManifest },
  introsModule,
  { manifest: adminManifest },
];
