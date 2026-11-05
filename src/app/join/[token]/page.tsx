import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { InviterNote } from "@/components/inviter-note";
import { CommunityNote, SplitLayout } from "@/components/split-layout";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/database/client";
import { readActiveSession } from "@/lib/active-session";
import { readBrandingForPage } from "@/lib/branding/branding";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { recordFailedInviteAttempt } from "@/lib/invites/invite-attempts";
import {
  INVITE_INVALID_COPY,
  INVITE_RATE_LIMITED_COPY,
  INVITE_UNUSABLE_COPY,
  type InviteUnusableCopy,
} from "@/lib/invites/invite-copy";
import { INVITE_LIFETIME_DAYS, INVITE_STATES } from "@/lib/invites/invite-state";
import { readInviteByToken } from "@/lib/invites/invites";
import { ROUTES } from "@/lib/routes";

import { AcceptForm } from "./accept-form";
import { SignOutToAccept } from "./sign-out-to-accept";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: PAGE_TITLES.join, robots: { index: false, follow: false } };

type Community = Awaited<ReturnType<typeof readBrandingForPage>>;

function readCommunityName(community: Community) {
  return community.isSaved ? community.name : "this community";
}

async function readUnknownLinkCopy(requestHeaders: Headers) {
  const { isLimited } = await recordFailedInviteAttempt(getDatabase(), requestHeaders, process.env);
  return isLimited ? INVITE_RATE_LIMITED_COPY : INVITE_INVALID_COPY;
}

type UnusableLinkProps = {
  community: Community;
  copy: InviteUnusableCopy;
  inviterName?: string | null;
  isMemberLikely?: boolean;
};

function UnusableLink({ community, copy, inviterName, isMemberLikely = false }: UnusableLinkProps) {
  const { icon, title, description } = copy;
  return (
    <SplitLayout
      community={community}
      note={<CommunityNote community={community}>This is a private community, open by invitation.</CommunityNote>}
    >
      <div className="flex min-h-[60dvh] items-center justify-center lg:min-h-[calc(100dvh-140px)]">
        <EmptyState headingLevel="h1" icon={icon} title={title} description={description}>
          {inviterName ? <p className="type-small text-muted-foreground">Your invite came from {inviterName}.</p> : null}
          <Button asChild size="lg" variant={isMemberLikely ? "primary" : "outline"}>
            <Link href={ROUTES.signIn}>{isMemberLikely ? "Go to sign in" : "Already a member? Sign in"}</Link>
          </Button>
        </EmptyState>
      </div>
    </SplitLayout>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const requestHeaders = await headers();
  const community = await readBrandingForPage();
  const invite = await readInviteByToken(getDatabase(), token);

  if (!invite) return <UnusableLink community={community} copy={await readUnknownLinkCopy(requestHeaders)} />;
  if (invite.state !== INVITE_STATES.pending) {
    return (
      <UnusableLink
        community={community}
        copy={INVITE_UNUSABLE_COPY[invite.state]}
        inviterName={invite.inviter?.name}
        isMemberLikely={invite.state === INVITE_STATES.accepted}
      />
    );
  }

  const { inviter } = invite;
  const session = await readActiveSession(requestHeaders);

  return (
    <SplitLayout
      community={community}
      people={inviter ? [{ id: inviter.id ?? inviter.name, name: inviter.name }] : []}
      note={
        inviter ? (
          <InviterNote inviter={inviter} communityName={community.name}>
            We saved you a seat. Come on in.
          </InviterNote>
        ) : (
          <CommunityNote community={community}>We saved you a seat. Come on in.</CommunityNote>
        )
      }
    >
      <h1 className="type-h1 lg:type-display">You&apos;re invited.</h1>
      <p className="type-lead mt-3 text-foreground-soft">
        {inviter ? `${inviter.name} invited you` : "You've been invited"} to join {readCommunityName(community)}.
      </p>
      <div className="mt-7 rounded-panel bg-card p-5 shadow-panel sm:p-7">
        {session ? (
          <SignOutToAccept signedInName={session.user.name} path={`${ROUTES.join}/${token}`} />
        ) : (
          <AcceptForm token={token} email={invite.email} />
        )}
      </div>
      <p className="type-small mt-4 text-muted-foreground">
        Invites work once and last {INVITE_LIFETIME_DAYS} days. Your email stays private: only admins see it.
      </p>
    </SplitLayout>
  );
}
