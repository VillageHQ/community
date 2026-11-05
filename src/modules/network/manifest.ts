import { Waypoints } from "lucide-react";

import { API_ROUTES, ROUTES } from "../../platform/http/routes.ts";
import { MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";

export const networkManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "network",
  label: "Network",
  description: "Members search each other's networks through Village. Needs a Village account.",
  icon: Waypoints,
  isOnByDefault: true,
  needsVillage: true,
  requires: [],
  navigation: [{ label: "Network", href: ROUTES.network, icon: Waypoints, section: NAVIGATION_SECTIONS.primary }],
  adminTabs: [{ label: "Credits", href: ROUTES.adminCredits }],
  paths: {
    pages: [ROUTES.network, ROUTES.adminCredits],
    api: ["/api/network", "/api/admin/village", API_ROUTES.dailyLimit, API_ROUTES.setupDomain],
  },
} satisfies ToggleableManifest;
