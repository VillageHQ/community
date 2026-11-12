import type { Metadata } from "next";
import { headers } from "next/headers";

import { PublicPage } from "@/components/public-page";
import { getDatabase } from "@/platform/database/client";
import { readActiveSession } from "@/platform/auth/active-session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { recordFailedInviteAttempt } from "@/modules/members/limits-invites";
import { INVITE_RATE_LIMITED_COPY } from "@/modules/members/copy-invites";
import { INVITE_LIFETIME_DAYS, INVITE_STATES } from "@/modules/members/contract-invite-state";
import { readInviteByToken } from "@/modules/members/service-invites";
import { ROUTES, toInvitePath } from "@/platform/http/routes";
import { membersManifest } from "@/modules/members/manifest";
import { modulePage } from "@/platform/modules/module-page";

import { AcceptForm } from "./accept-form";
import { SignOutToAccept } from "./sign-out-to-accept";

export const dynamic = "force-dynamic";

const MAXIMUM_TOKEN_LENGTH = 256;

type InvitePageProps = { searchParams: Promise<{ token?: string; e?: string }> };

type Community = Awaited<ReturnType<typeof readBrandingForPage>>;

async function readOpenInvite(token: string | undefined) {
  if (!token || token.length > MAXIMUM_TOKEN_LENGTH) return null;
  const invite = await readInviteByToken(getDatabase(), token);
  return invite?.state === INVITE_STATES.pending ? invite : null;
}

export async function generateMetadata({ searchParams }: InvitePageProps): Promise<Metadata> {
  const invite = await readOpenInvite((await searchParams).token);
  return { title: invite ? PAGE_TITLES.join : PAGE_TITLES.linkNotValid, robots: { index: false, follow: false } };
}

// Founderhall's badLinkPage for an invite: used, expired, withdrawn or unknown all read the same, so the page never
// tells which invites exist. Someone who never joined needs a new invite, not a sign-in link (the owner's call), so
// the sign-in link stays one line below. Too many tries from one place get Community's wait-a-minute line.
function BadInviteLink({ community, isLimited }: { community: Community; isLimited: boolean }) {
  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">That link doesn’t work any more</h1>
      <p className="fh-lede">
        {isLimited
          ? INVITE_RATE_LIMITED_COPY.description
          : `Invite links work once and last ${INVITE_LIFETIME_DAYS} days. Ask whoever invited you to ${community.name} for a new invite.`}
      </p>
      <p className="fh-small fh-muted mt-4">
        Already joined? <a href={ROUTES.signIn}>Sign in</a>.
      </p>
    </PublicPage>
  );
}

// Founderhall's /invite?token= (confirmPage, kind invite).
export default modulePage(membersManifest, async function InvitePage({ searchParams }: InvitePageProps) {
  const { token, e: emailedMark } = await searchParams;
  const requestHeaders = await headers();
  const community = await readBrandingForPage();
  const invite = await readOpenInvite(token);

  if (!token || !invite) {
    const { isLimited } = await recordFailedInviteAttempt(getDatabase(), requestHeaders, process.env);
    return <BadInviteLink community={community} isLimited={isLimited} />;
  }

  const session = await readActiveSession(requestHeaders);
  return (
    <PublicPage community={community}>
      <h1 className="fh-h2">Join {community.name}</h1>
      <p className="fh-lede">
        You were invited as <b>{invite.email}</b>.
      </p>
      {session ? <SignOutToAccept signedInName={session.user.name} path={toInvitePath(token, emailedMark ?? null)} /> : <AcceptForm token={token} emailedMark={emailedMark ?? null} />}
      <p className="fh-small fh-muted mt-3.5">Next: two questions about you. Nobody is introduced without saying yes.</p>
    </PublicPage>
  );
});
