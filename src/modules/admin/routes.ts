import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { adminManifest } from "./manifest";

export const adminRoutes = createModuleRoutes(adminManifest);
