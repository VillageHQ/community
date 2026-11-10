import "server-only";

import type { ModuleIntegration } from "@/platform/modules/integration";

import { perksManifest } from "./manifest";

export const perksModule: ModuleIntegration = { manifest: perksManifest };
