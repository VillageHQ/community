import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { adminManifest } from "./admin/manifest";
import { asksModule } from "./asks/integration";
import { feedModule } from "./feed/integration";
import { introsModule } from "./intros/integration";
import { jobBoardModule } from "./job-board/integration";
import { membersManifest } from "./members/manifest";
import { messagesModule } from "./messages/integration";
import { networkModule } from "./network/integration";

// A module adds one line here. The order is the order of the navigation.
export const MODULES: readonly ModuleIntegration[] = [
  feedModule,
  messagesModule,
  { manifest: membersManifest },
  networkModule,
  introsModule,
  asksModule,
  jobBoardModule,
  { manifest: adminManifest },
];
