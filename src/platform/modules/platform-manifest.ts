import { Server } from "lucide-react";

import { API_ROUTES, AUTH_BASE_PATH, ROUTES } from "../http/routes.ts";
import { MODULE_KINDS, type CoreManifest } from "./manifest.ts";

export const PLATFORM_MANIFEST = {
  kind: MODULE_KINDS.core,
  id: "platform",
  label: "Platform",
  description: "Sign-in, setup and the community's brand.",
  icon: Server,
  navigation: [],
  adminTabs: [],
  requires: [],
  needsVillage: false,
  paths: {
    pages: [ROUTES.signIn, ROUTES.signUp, ROUTES.forgotPassword, ROUTES.resetPassword, ROUTES.recoverAdmin, ROUTES.setup, ROUTES.unsubscribe, ROUTES.weeklyAnswer],
    api: [AUTH_BASE_PATH, "/api/health", API_ROUTES.setup, API_ROUTES.recoverAdmin, API_ROUTES.signInLink, API_ROUTES.demoSignIn, API_ROUTES.brandingLogo, API_ROUTES.jobsTick, "/api/email"],
  },
} satisfies CoreManifest;
