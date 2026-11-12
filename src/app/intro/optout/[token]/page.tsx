import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicPage } from "@/components/public-page";
import { introsManifest } from "@/modules/intros/manifest";
import { OptOutQuestion } from "@/modules/intros/components/public-intro";
import { readOptOutAddress } from "@/modules/intros/service-consent";
import { readBrandingForPage } from "@/platform/branding/branding";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Stop intro asks", robots: { index: false, follow: false } };

// Founderhall's opt-out page, from "Don't send me intro asks" in the person's email or on their page.
export default modulePage(introsManifest, async function IntroOptOutPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [community, address] = await Promise.all([readBrandingForPage(), readOptOutAddress(getDatabase(), token)]);
  // Founderhall answers an unknown link with a 404 (not-found.tsx beside this page has its words).
  if (!address) notFound();
  return (
    <PublicPage community={community}>
      <OptOutQuestion token={token} community={community.name} email={address.email ?? "this address"} />
    </PublicPage>
  );
});
