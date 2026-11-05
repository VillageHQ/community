import { HandHelping } from "lucide-react";

import { MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";
import { ASK_API_ROUTES, ASKS_PAGE } from "./contract.ts";

export const asksManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "asks",
  label: "Asks",
  description: "Members post what they need, and others step in.",
  icon: HandHelping,
  isOnByDefault: false,
  needsVillage: false,
  requires: [],
  navigation: [{ label: "Asks", href: ASKS_PAGE, icon: HandHelping, section: NAVIGATION_SECTIONS.primary, badge: "asks" }],
  adminTabs: [],
  paths: { pages: [ASKS_PAGE], api: [ASK_API_ROUTES.board] },
} satisfies ToggleableManifest;
