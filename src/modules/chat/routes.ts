import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { chatManifest } from "./manifest";

export const chatRoutes = createModuleRoutes(chatManifest);
