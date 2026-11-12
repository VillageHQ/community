import { Users } from "lucide-react";

import { API_ROUTES, ROUTES } from "../../platform/http/routes.ts";
import { MODULE_KINDS, NAVIGATION_SECTIONS, type CoreManifest } from "../../platform/modules/manifest.ts";

export const membersManifest = {
  kind: MODULE_KINDS.core,
  id: "members",
  label: "Members and invites",
  description: "Profiles, the directory, invites and blocks.",
  icon: Users,
  needsVillage: false,
  requires: [],
  navigation: [{ label: "Directory", href: ROUTES.members, icon: Users, section: NAVIGATION_SECTIONS.primary }],
  adminTabs: [],
  paths: {
    pages: [ROUTES.feed, ROUTES.today, ROUTES.landing, ROUTES.welcome, ROUTES.members, ROUTES.people, ROUTES.editCard, ROUTES.join, ROUTES.confirmEmail],
    api: [API_ROUTES.members, API_ROUTES.profile, API_ROUTES.onboarding, API_ROUTES.invites, API_ROUTES.inviteAccept, API_ROUTES.inviteNotMe],
  },
} satisfies CoreManifest;
