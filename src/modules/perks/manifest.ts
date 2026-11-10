import { Gift } from "lucide-react";

import { MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";
import { PERKS_ADMIN_PAGE, PERKS_API_ROUTES, PERKS_PAGE } from "./contract.ts";

export const perksManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "perks",
  label: "Perks",
  description: "Your BuiltFirst perks marketplace, inside the app, with a card on Today.",
  turnOffNote: "Members stop seeing Perks. The marketplace address stays saved.",
  icon: Gift,
  isOnByDefault: false,
  needsVillage: false,
  requires: [],
  // The page frames the marketplace under its own security policy, which only a full page load applies.
  navigation: [{ label: "Perks", href: PERKS_PAGE, icon: Gift, section: NAVIGATION_SECTIONS.primary, isFullPageLoad: true }],
  adminTabs: [{ label: "Perks", href: PERKS_ADMIN_PAGE }],
  paths: { pages: [PERKS_PAGE, PERKS_ADMIN_PAGE], api: [PERKS_API_ROUTES.save] },
} satisfies ToggleableManifest;
