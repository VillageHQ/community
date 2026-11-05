import { MessageCircle } from "lucide-react";

import { API_ROUTES, ROUTES } from "../../platform/http/routes.ts";
import { MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";

export const messagesManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "messages",
  label: "Messages",
  description: "Members write to each other in private conversations.",
  icon: MessageCircle,
  isOnByDefault: true,
  needsVillage: false,
  requires: [],
  navigation: [{ label: "Messages", href: ROUTES.messages, icon: MessageCircle, section: NAVIGATION_SECTIONS.primary, badge: "messages" }],
  adminTabs: [],
  paths: { pages: [ROUTES.messages], api: [API_ROUTES.messages] },
} satisfies ToggleableManifest;
