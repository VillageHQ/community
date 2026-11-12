import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { readBrandingForPage } from "@/platform/branding/branding";

export const metadata: Metadata = { title: "Stop intro asks", robots: { index: false, follow: false } };

// Founderhall's opt-out page for an unknown link: the question without its button, and a 404.
export default async function IntroOptOutNotFound() {
  const community = await readBrandingForPage();
  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">Stop intro asks from {community.name}?</h1>
      <p className="fh-lede">We won’t send intro asks to this address again. Any ask waiting for you now closes, and nobody is told why.</p>
      <p className="fh-small mt-4">This link doesn’t work. It may be old or cut short.</p>
    </PublicPage>
  );
}
