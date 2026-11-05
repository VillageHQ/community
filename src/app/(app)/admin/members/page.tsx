import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { MailPlus } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { MAXIMUM_SEARCH_LENGTH, MEMBER_FILTERS } from "@/lib/admin/admin-api";
import { readAdminMembers } from "@/lib/admin/member-list";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readResendConfig } from "@/platform/email/resend";
import { INVITE_FILTERS } from "@/lib/invites/invite-api";
import { readInvites } from "@/lib/invites/invites";
import { readWaitingMemberCount, readWaitingMembers } from "@/lib/members/member-admin";
import { requireAdmin } from "@/platform/auth/session";

import { AdminSection } from "@/app/(app)/admin/admin-section";
import { InviteManager, INVITE_SECTION_ID } from "./invite-manager";
import { inviteListQuery, waitingMembersQuery } from "./invite-queries";
import { memberPageQuery } from "./member-queries";

const FIRST_PAGE = 1;

export const metadata: Metadata = { title: PAGE_TITLES.adminMembers };

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ search?: string }> }) {
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
}
