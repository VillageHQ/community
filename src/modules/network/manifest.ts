import { Waypoints } from "lucide-react";

import { API_ROUTES, ROUTES } from "../../platform/http/routes.ts";
import { MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";

export const networkManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "network",
  label: "Network",
  description: "Members search each other's networks through Village.",
  icon: Waypoints,
  turnOffNote: "Members stay in the Village group, and their networks stay shared in Village until they leave. We don't remove anyone.",
  isOnByDefault: true,
  needsVillage: true,
  requires: [],
  navigation: [{ label: "Meet", href: ROUTES.network, icon: Waypoints, section: NAVIGATION_SECTIONS.primary }],
  adminTabs: [{ label: "Village", href: ROUTES.adminVillage }],
  paths: {
    pages: [ROUTES.network, ROUTES.adminVillage],
    api: ["/api/network", "/api/admin/village", API_ROUTES.dailyLimit, API_ROUTES.monthlyCap],
  },
} satisfies ToggleableManifest;
