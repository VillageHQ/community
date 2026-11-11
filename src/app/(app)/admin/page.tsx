import type { Metadata } from "next";

import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { adminManifest } from "@/modules/admin/manifest";
import { readConsoleHomePage } from "@/shell/admin-home";
import { AdminHomeView } from "@/shell/admin-home-view";
import { readFirstName } from "@/shell/console-launch";
import { ConsoleLaunchView } from "@/shell/console-launch-view";

export const metadata: Metadata = { title: PAGE_TITLES.admin };

const CHECKLIST_PARAM = "checklist";

// The console's Home: the launch checklist until all four steps are done once (and on ?checklist=1 after), then the
// dashboard of every intro, the members, the network, lookups, asks and mail.
export default modulePage(adminManifest, async function AdminHomePage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> } = {}) {
  const admin = await requireAdmin();
  const query = (await searchParams) ?? {};
  const { communityName, steps, isLaunched, home, items } = await readConsoleHomePage(getDatabase(), process.env);
  if (!isLaunched || !home || query[CHECKLIST_PARAM] === "1") return <ConsoleLaunchView firstName={readFirstName(admin.name, admin.email)} steps={steps} />;
  return <AdminHomeView communityName={communityName} home={home} items={items} />;
});
