import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
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

// Founderhall's Perks (copy/member-perks-on.md): the head, BuiltFirst's marketplace in its frame, one line under it.
// This page has its own Content-Security-Policy (next.config.mjs): frames from BuiltFirst only.
export default modulePage(perksManifest, async function PerksPage() {
  await requireMember();
  const [url, community] = await Promise.all([readPerksUrl(getDatabase()), readBrandingForPage()]);
  const isDemo = isDemoMode(process.env);

  return (
    <>
      <PageHeader title="Perks" description={`Deals for ${community.name} founders, run by BuiltFirst.`} />
      {/* The demo never frames BuiltFirst: its frame holds made-up deals instead. */}
      {isDemo || url ? (
        <>
          {url && !isDemo ? <PerksFrame url={url} title={`Perks for ${community.name} founders`} /> : <DemoPerksList />}
          <p className="fh-small fh-muted mt-2.5">BuiltFirst may ask you to sign in with your BuiltFirst account.</p>
        </>
      ) : (
        <EmptyState title="No perks yet" description="Your admin hasn’t added the perks marketplace yet. It shows up here when they do." />
      )}
    </>
  );
});
