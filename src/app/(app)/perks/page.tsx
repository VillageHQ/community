import { Gift } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { DemoPerksList } from "@/modules/perks/components/demo-perks-list";
import { PerksFrame } from "@/modules/perks/components/perks-frame";
import { perksManifest } from "@/modules/perks/manifest";
import { readPerksUrl } from "@/modules/perks/service";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { isDemoMode } from "@/platform/demo/mode";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.perks };

// This page has its own Content-Security-Policy (next.config.mjs): frames from BuiltFirst only.
export default modulePage(perksManifest, async function PerksPage() {
  await requireMember();
  const [url, community] = await Promise.all([readPerksUrl(getDatabase()), readBrandingForPage()]);
  const isDemo = isDemoMode(process.env);

  return (
    <>
      <PageHeader title="Perks" description={isDemo ? `Deals for ${community.name} members.` : `Deals for ${community.name} members, run by BuiltFirst.`} />
      {/* The demo never frames BuiltFirst: it lists made-up deals instead. */}
      {isDemo ? (
        <DemoPerksList />
      ) : url ? (
        <div className="grid gap-3">
          <PerksFrame url={url} title={`Perks for ${community.name} members`} />
          <p className="type-small text-muted-foreground">BuiltFirst may ask you to sign in with a BuiltFirst account.</p>
        </div>
      ) : (
        <Card className="grid max-w-[640px] justify-items-start gap-2 sm:p-5">
          <Gift aria-hidden="true" className="size-6 text-brand-emphasis" />
          <p className="type-label">No perks yet</p>
          <p className="type-small text-foreground-soft">Your admin hasn&apos;t added the perks marketplace yet. It shows up here when they do.</p>
        </Card>
      )}
    </>
  );
});
