import { ShieldCheck } from "lucide-react";

import { API_ROUTES, ROUTES } from "../../platform/http/routes.ts";
import { MODULE_KINDS, NAVIGATION_SECTIONS, type CoreManifest } from "../../platform/modules/manifest.ts";

export const adminManifest = {
  kind: MODULE_KINDS.core,
  id: "admin",
  label: "Admin",
  description: "Your members, reports, audit log and settings.",
  icon: ShieldCheck,
  needsVillage: false,
  requires: [],
  navigation: [{ label: "Admin", href: ROUTES.admin, icon: ShieldCheck, section: NAVIGATION_SECTIONS.admin, badge: "admin" }],
  adminTabs: [],
  paths: { pages: [ROUTES.admin], api: [API_ROUTES.branding, "/api/admin/members", "/api/admin/reports", API_ROUTES.auditLog, API_ROUTES.moduleState] },
} satisfies CoreManifest;
