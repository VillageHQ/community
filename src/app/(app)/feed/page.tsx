import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Feed } from "@/modules/feed/components/feed";
import { feedManifest } from "@/modules/feed/manifest";
import { feedQuery } from "@/modules/feed/queries";
import { readFeedPage } from "@/modules/feed/reads";
import { readAvatarUrl } from "@/modules/members/service-profile";
import { isAdminMember } from "@/platform/auth/roles";
import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.feed };

// Community's switchable feed (Founderhall has none): posts, replies and reactions on a page of their own, in
// Founderhall's page head and one column. On where no admin chose; its menu item shows only while it's on.
export default modulePage(feedManifest, async function FeedPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [community, avatarUrl, feedPage] = await Promise.all([readBrandingForPage(), readAvatarUrl(database, member.id), readFeedPage(database, member, null)]);
  const queryClient = new QueryClient();
  queryClient.setQueryData(feedQuery().queryKey, { pages: [feedPage], pageParams: [null] });
  return (
    <>
      <PageHeader title="Feed" description={`What members of ${community.name} share: news, wins and questions, with replies.`} />
      <div className="max-w-[560px]">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Feed viewer={{ id: member.id, name: member.name, avatarUrl, isAdmin: isAdminMember(member) }} />
        </HydrationBoundary>
      </div>
    </>
  );
});
