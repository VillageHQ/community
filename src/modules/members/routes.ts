import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { membersManifest } from "./manifest";

export const membersRoutes = createModuleRoutes(membersManifest);
