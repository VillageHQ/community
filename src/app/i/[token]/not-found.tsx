import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { readBrandingForPage } from "@/platform/branding/branding";

export const metadata: Metadata = { title: "Nothing to do", robots: { index: false, follow: false } };

// Founderhall's answer to an unknown or cut-short intro link: the closed card's words, with a 404.
export default async function IntroLinkNotFound() {
  const community = await readBrandingForPage();
  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">Nothing to do</h1>
      <p className="fh-lede">This link doesn’t work. It may be old or cut short.</p>
    </PublicPage>
  );
}
