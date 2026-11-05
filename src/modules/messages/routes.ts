import "server-only";

import { createModuleRoutes } from "@/platform/modules/module-routes";

import { messagesManifest } from "./manifest";

export const messagesRoutes = createModuleRoutes(messagesManifest);
