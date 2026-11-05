import "server-only";

import { createModuleRoutes } from "./module-routes.ts";
import { PLATFORM_MANIFEST } from "./platform-manifest.ts";

export const platformRoutes = createModuleRoutes(PLATFORM_MANIFEST);
