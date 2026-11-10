import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { chatManifest } from "./manifest";

// The posting job reads asks and intros, so it lives in the shell (src/shell/chat-posts.ts) and checks this module itself.
export const chatModule: ModuleIntegration = { manifest: chatManifest };
