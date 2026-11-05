import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { introsManifest } from "./manifest";

export const introsRoutes = createModuleRoutes(introsManifest);
