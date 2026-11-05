import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { feedManifest } from "./manifest";

export const feedRoutes = createModuleRoutes(feedManifest);
