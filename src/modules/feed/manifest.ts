import { House } from "lucide-react";

import { API_ROUTES, ROUTES } from "../../platform/http/routes.ts";
import { MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";

export const feedManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "feed",
  label: "Feed",
  description: "Members post updates, reply and react on the home page.",
  icon: House,
  isOnByDefault: true,
  needsVillage: false,
  requires: [],
  navigation: [{ label: "Feed", href: ROUTES.feed, icon: House, section: NAVIGATION_SECTIONS.primary }],
  adminTabs: [],
  paths: { pages: [], api: [API_ROUTES.feed] },
} satisfies ToggleableManifest;
