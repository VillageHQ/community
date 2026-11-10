import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { adminManifest } from "./admin/manifest";
import { asksModule } from "./asks/integration";
import { chatModule } from "./chat/integration";
import { feedModule } from "./feed/integration";
import { introsModule } from "./intros/integration";
import { membersManifest } from "./members/manifest";
import { messagesModule } from "./messages/integration";
import { networkModule } from "./network/integration";
import { perksModule } from "./perks/integration";

// A module adds one line here. The order is the order of the navigation.
export const MODULES: readonly ModuleIntegration[] = [
  feedModule,
  messagesModule,
  { manifest: membersManifest },
  networkModule,
  introsModule,
  asksModule,
  perksModule,
  chatModule,
  { manifest: adminManifest },
];
