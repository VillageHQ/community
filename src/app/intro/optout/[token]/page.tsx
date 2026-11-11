import type { Metadata } from "next";

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
  return (
    <PublicPage community={community}>
      {address ? (
        <OptOutQuestion token={token} community={community.name} email={address.email ?? "this address"} />
      ) : (
        <>
          <h1 className="fh-h2">Stop intro asks from {community.name}?</h1>
          <p className="fh-lede">We won’t send intro asks to this address again. Any ask waiting for you now closes, and nobody is told why.</p>
          <p className="fh-small mt-4">This link doesn’t work. It may be old or cut short.</p>
        </>
      )}
    </PublicPage>
  );
});
