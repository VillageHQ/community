import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { readBrandingForPage } from "@/platform/branding/branding";
import { membersManifest } from "@/modules/members/manifest";
import { modulePage } from "@/platform/modules/module-page";

import { NotMeForm } from "./not-me-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Someone used your invite?", robots: { index: false, follow: false } };

type NotMePageProps = { searchParams: Promise<{ m?: string; s?: string }> };

// From "Your invite was used" (members' service-invite-notice.ts). Opening the page changes nothing: a mail scanner
// that follows links must not sign anyone out. The button does it.
export default modulePage(membersManifest, async function NotMePage({ searchParams }: NotMePageProps) {
  const { m: member = "", s: signature = "" } = await searchParams;
  const community = await readBrandingForPage();
  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">Someone else used your invite?</h1>
      <p className="fh-lede">
        If you didn’t join {community.name} yourself, press the button. We’ll sign that person out, and your admins will see it and send you a new
        invite.
      </p>
      <NotMeForm member={member} signature={signature} />
      <p className="fh-small fh-muted mt-3.5">If you did join, close this page: nothing changes.</p>
    </PublicPage>
  );
});
