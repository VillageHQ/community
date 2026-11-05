import { Handshake } from "lucide-react";

import { API_ROUTES, ROUTES } from "../../platform/http/routes.ts";
import { MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";
import { networkManifest } from "../network/manifest.ts";

export const introsManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "intros",
  label: "Intros",
  description: "Members ask each other for warm introductions.",
  icon: Handshake,
  isOnByDefault: true,
  needsVillage: true,
  requires: [networkManifest],
  navigation: [{ label: "Intros", href: ROUTES.intros, icon: Handshake, section: NAVIGATION_SECTIONS.primary, badge: "intros" }],
  adminTabs: [],
  paths: { pages: [ROUTES.intros], api: [API_ROUTES.intros] },
} satisfies ToggleableManifest;
