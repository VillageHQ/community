import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { jobBoardManifest } from "./manifest";

export const jobBoardRoutes = createModuleRoutes(jobBoardManifest);
