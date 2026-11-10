import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { perksManifest } from "./manifest";

export const perksRoutes = createModuleRoutes(perksManifest);
