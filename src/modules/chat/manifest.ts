import { MessagesSquare } from "lucide-react";

import { MODULE_KINDS, type ToggleableManifest } from "../../platform/modules/manifest.ts";
import { CHAT_ADMIN_PAGE, CHAT_API_ROUTES } from "./contract.ts";

export const chatManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "chat",
  label: "Slack and Discord",
  description: "New asks and a weekly line go to your Slack or Discord, and members can post an ask with /ask in Slack.",
  turnOffNote: "Nothing more is posted and /ask stops answering. The tokens stay saved until you disconnect.",
  icon: MessagesSquare,
  isOnByDefault: false,
  needsVillage: false,
  requires: [],
  navigation: [],
  adminTabs: [{ label: "Integrations", href: CHAT_ADMIN_PAGE }],
  paths: { pages: [CHAT_ADMIN_PAGE], api: [CHAT_API_ROUTES.admin, "/api/chat"] },
} satisfies ToggleableManifest;
