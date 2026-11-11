import type { Metadata } from "next";

import { PublicPage } from "@/components/public-page";
import { Button, ButtonRow } from "@/components/ui/button";
import { readSignInLinkEmail } from "@/platform/auth/sign-in-link-verify";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { PLATFORM_MANIFEST } from "@/platform/modules/platform-manifest";
import { modulePage } from "@/platform/modules/module-page";

import { SignInLinkConfirm } from "./sign-in-link-confirm";

export const dynamic = "force-dynamic";

const MAXIMUM_TOKEN_LENGTH = 256;

type AuthPageProps = { searchParams: Promise<{ token?: string }> };

async function readLinkEmail(token: string | undefined) {
  if (!token || token.length > MAXIMUM_TOKEN_LENGTH) return null;
  return readSignInLinkEmail(getDatabase(), token);
}

export async function generateMetadata({ searchParams }: AuthPageProps): Promise<Metadata> {
  const email = await readLinkEmail((await searchParams).token);
  return { title: email ? PAGE_TITLES.signIn : PAGE_TITLES.linkNotValid, robots: { index: false, follow: false } };
}

// Founderhall's /auth (confirmPage, badLinkPage). Opening the emailed link never signs anyone in: the page reads the
// link without using it, and only the button's POST signs in, so a mail scanner that opens it changes nothing.
export default modulePage(PLATFORM_MANIFEST, async function SignInLinkPage({ searchParams }: AuthPageProps) {
  const community = await readBrandingForPage();
  const { token } = await searchParams;
  const email = await readLinkEmail(token);

  if (!token || !email) {
    return (
      <PublicPage community={community}>
        <h1 className="fh-h2">That link doesn’t work any more</h1>
        <p className="fh-lede">Sign-in links work once and last 15 minutes. Ask for a fresh sign-in link instead.</p>
        <ButtonRow className="mt-4">
          <Button asChild>
            <a href={ROUTES.signIn}>Get a new sign-in link</a>
          </Button>
        </ButtonRow>
      </PublicPage>
    );
  }

  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">Sign in to {community.name}</h1>
      <p className="fh-lede">
        Signing in as <b>{email}</b>.
      </p>
      <SignInLinkConfirm token={token} />
    </PublicPage>
  );
});
