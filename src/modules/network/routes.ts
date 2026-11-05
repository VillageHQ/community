import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { networkManifest } from "./manifest";

export const networkRoutes = createModuleRoutes(networkManifest);
