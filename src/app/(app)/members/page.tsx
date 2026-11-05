import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { UserRound } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readDirectory } from "@/modules/members/reads-directory";
import { parseDirectoryFilters } from "@/modules/members/rules-directory-url";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";

import { MemberDirectory } from "@/modules/members/components/member-directory";
import { directoryQuery } from "@/modules/members/queries-directory";
import { membersManifest } from "@/modules/members/manifest";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.members };

function readMemberSentence(memberCount: number, communityName: string, isCommunityNamed: boolean) {
  const members = memberCount === 1 ? "1 member" : `${memberCount} members`;
  return isCommunityNamed ? `${members} of ${communityName}.` : `${members} so far.`;
}

type MembersPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default modulePage(membersManifest, async function MembersPage({ searchParams }: MembersPageProps) {
  const { id: viewerId } = await requireMember();
  const filters = parseDirectoryFilters(await searchParams);
  const [directory, community] = await Promise.all([readDirectory(getDatabase(), filters), readBrandingForPage()]);

  const queryClient = new QueryClient();
  queryClient.setQueryData(directoryQuery(filters).queryKey, directory);

  return (
    <>
      <PageHeader
        title="Members"
        description={readMemberSentence(directory.memberCount, community.name, community.isSaved)}
        action={
          <Button asChild variant="outline">
            <Link href={ROUTES.editCard}>
              <UserRound aria-hidden="true" />
              Edit my card
            </Link>
          </Button>
        }
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MemberDirectory viewerId={viewerId} />
      </HydrationBoundary>
    </>
  );
});
