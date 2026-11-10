import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { MailPlus } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { INVITE_SECTION_ID, MAXIMUM_SEARCH_LENGTH, MEMBER_FILTERS } from "@/modules/admin/contract";
import { readAdminMembers } from "@/modules/admin/reads-members";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readResendConfig } from "@/platform/email/resend";
import { INVITE_FILTERS } from "@/modules/members/contract-invites";
import { readInvites } from "@/modules/members/service-invites";
import { readWaitingMemberCount, readWaitingMembers } from "@/modules/members/service-admin";
import { requireAdmin } from "@/platform/auth/session";

import { AdminSection } from "@/shell/admin-section";
import { InviteManager } from "@/modules/admin/components/invite-manager";
import { inviteListQuery, waitingMembersQuery } from "@/modules/members/queries-invites";
import { memberPageQuery } from "@/modules/admin/queries-members";
import { adminManifest } from "@/modules/admin/manifest";
import { modulePage } from "@/platform/modules/module-page";

const FIRST_PAGE = 1;

export const metadata: Metadata = { title: PAGE_TITLES.adminMembers };

export default modulePage(adminManifest, async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
  const admin = await requireAdmin();
  const { search: requestedSearch } = await searchParams;
  const search = (requestedSearch ?? "").trim().slice(0, MAXIMUM_SEARCH_LENGTH);
  const isEmailConfigured = readResendConfig(process.env) !== null;

  const database = getDatabase();
  const [invites, members, waitingCount, memberPage] = await Promise.all([
    readInvites(database, FIRST_PAGE, INVITE_FILTERS.all),
    readWaitingMembers(database),
    readWaitingMemberCount(database),
    readAdminMembers(database, { search, filter: MEMBER_FILTERS.all, page: FIRST_PAGE }),
  ]);

  const queryClient = new QueryClient();
  queryClient.setQueryData(inviteListQuery(FIRST_PAGE, INVITE_FILTERS.all).queryKey, invites);
  queryClient.setQueryData(waitingMembersQuery.queryKey, { members, waitingCount });
  queryClient.setQueryData(memberPageQuery({ search, filter: MEMBER_FILTERS.all, page: FIRST_PAGE }).queryKey, memberPage);

  return (
    <AdminSection
      title="Members"
      description="Everything about your people, in one place."
      action={
        <Button asChild size="lg" className="max-sm:w-full">
          <a href={`#${INVITE_SECTION_ID}`}>
            <MailPlus aria-hidden="true" />
            Invite someone
          </a>
        </Button>
      }
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <InviteManager isEmailConfigured={isEmailConfigured} viewerId={admin.id} initialSearch={search} />
      </HydrationBoundary>
    </AdminSection>
  );
});
