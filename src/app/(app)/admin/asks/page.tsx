import type { Metadata } from "next";

import { asksManifest } from "@/modules/asks/manifest";
import { requireAdmin } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";
import { readAdminAsks } from "@/shell/admin-asks";
import { ASKS_FLASHES, AdminAsksView } from "@/shell/admin-asks-view";

export const metadata: Metadata = { title: "Asks & digest" };

type AdminAsksPageProps = { searchParams: Promise<{ m?: string }> };

export default modulePage(asksManifest, async function AdminAsksPage({ searchParams }: AdminAsksPageProps) {
  await requireAdmin();
  const { m } = await searchParams;
  const adminAsks = await readAdminAsks(getDatabase());
  return <AdminAsksView {...adminAsks} flash={(m && ASKS_FLASHES[m]) ?? null} />;
});
