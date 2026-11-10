import { BriefcaseBusiness } from "lucide-react";

import { MODULE_KINDS, NAVIGATION_SECTIONS, type ToggleableManifest } from "../../platform/modules/manifest.ts";
import { JOB_BOARD_ADMIN_API_PREFIX, JOB_BOARD_API_PREFIX, JOB_BOARD_PAGES } from "./contract.ts";

export const jobBoardManifest = {
  kind: MODULE_KINDS.toggleable,
  id: "job-board",
  label: "Jobs",
  description: "Founders show their companies' open jobs, pulled from their hiring tool every hour.",
  turnOffNote: "Linked hiring tools and their jobs are kept, and come back when you turn this on again. The public board and the website widget stop too.",
  icon: BriefcaseBusiness,
  isOnByDefault: false,
  needsVillage: false,
  requires: [],
  navigation: [{ label: "Jobs", href: JOB_BOARD_PAGES.board, icon: BriefcaseBusiness, section: NAVIGATION_SECTIONS.primary }],
  adminTabs: [{ label: "Jobs", href: JOB_BOARD_PAGES.admin }],
  paths: {
    pages: [JOB_BOARD_PAGES.board, JOB_BOARD_PAGES.admin, JOB_BOARD_PAGES.public],
    api: [JOB_BOARD_API_PREFIX, JOB_BOARD_ADMIN_API_PREFIX],
  },
} satisfies ToggleableManifest;
