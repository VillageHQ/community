import { House } from "lucide-react";

import { API_ROUTES, ROUTES } from "../../platform/http/routes.ts";
import { HOME_FEED_MODULE_ID, MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";

export const feedManifest = {
  kind: MODULE_KINDS.toggleable,
  id: HOME_FEED_MODULE_ID,
  label: "Feed",
  description: "Members post updates, reply and react on the Feed page.",
  icon: House,
  // On where no admin chose (the owner's call, 2026-11-12); a community whose admin switched it off stays off.
  isOnByDefault: true,
  needsVillage: false,
  requires: [],
  navigation: [{ label: "Feed", href: ROUTES.feedPage, icon: House, section: NAVIGATION_SECTIONS.primary }],
  adminTabs: [],
  paths: { pages: [ROUTES.feedPage], api: [API_ROUTES.feed] },
} satisfies ToggleableManifest;
