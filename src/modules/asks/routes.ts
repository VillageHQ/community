import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { asksManifest } from "./manifest";

export const asksRoutes = createModuleRoutes(asksManifest);
