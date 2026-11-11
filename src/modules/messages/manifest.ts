import { Inbox, MessageCircle } from "lucide-react";

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
  navigation: [{ label: "Inbox", href: ROUTES.messages, icon: Inbox, section: NAVIGATION_SECTIONS.primary, badge: "messages" }],
  adminTabs: [],
  paths: { pages: [ROUTES.messages, ROUTES.newMessage], api: [API_ROUTES.messages] },
} satisfies ToggleableManifest;
