import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import Link from "next/link";

import { getDatabase } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readDirectory } from "@/modules/members/reads-directory";
import { parseDirectoryFilters } from "@/modules/members/rules-directory-url";
import { requireMember } from "@/platform/auth/session";

import { MemberDirectory } from "@/modules/members/components/member-directory";
import { directoryQuery } from "@/modules/members/queries-directory";
import { membersManifest } from "@/modules/members/manifest";
import { JOB_BOARD_PAGES } from "@/modules/job-board/contract";
import { modulePage } from "@/platform/modules/module-page";
import { readDirectoryJobCount, readHiringLookup } from "@/shell/directory-hiring";

export const metadata: Metadata = { title: PAGE_TITLES.members };

function readMemberSentence(memberCount: number, communityName: string, isCommunityNamed: boolean) {
  const members = memberCount === 1 ? "1 member" : `${memberCount} members`;
  return `${isCommunityNamed ? `${members} of ${communityName}.` : `${members} so far.`} Each member writes their own profile.`;
}

type DirectoryPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Founderhall's Directory (member-directory-populated).
export default modulePage(membersManifest, async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  await requireMember();
  const filters = parseDirectoryFilters(await searchParams);
  const database = getDatabase();
  const [directory, community, jobCount] = await Promise.all([
    readDirectory(database, filters, new Date(), await readHiringLookup(database)),
    readBrandingForPage(),
    readDirectoryJobCount(database),
  ]);

  const queryClient = new QueryClient();
  queryClient.setQueryData(directoryQuery(filters).queryKey, directory);

  return (
    <>
      <header data-slot="page-header" className="fh-pagehead">
        <h1 className="fh-h1">Directory</h1>
        <p className="fh-lede">{readMemberSentence(directory.memberCount, community.name, community.isSaved)}</p>
        {jobCount === null ? null : (
          <p className="fh-small mt-2">
            <Building2 aria-hidden="true" className="fh-i fh-xs inline align-[-2px]" strokeWidth={1.5} />{" "}
            <Link href={JOB_BOARD_PAGES.board}>Jobs at member companies{jobCount ? ` (${jobCount})` : ""}</Link>
          </p>
        )}
      </header>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MemberDirectory />
      </HydrationBoundary>
    </>
  );
});
