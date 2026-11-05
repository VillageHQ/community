import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { getDatabase } from "@/database/client";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { readResendConfig } from "@/lib/email/resend";
import { INVITE_FILTERS } from "@/lib/invites/invite-api";
import { readInvites } from "@/lib/invites/invites";
import { readConfirmationBadgeCount, readWaitingMemberCount, readWaitingMembers } from "@/lib/members/member-admin";
import { requireAdmin } from "@/lib/session";

import { AdminTabs } from "../admin-tabs";
import { InviteManager } from "./invite-manager";
import { inviteListQuery, waitingMembersQuery } from "./invite-queries";

const FIRST_PAGE = 1;

export const metadata: Metadata = { title: PAGE_TITLES.adminMembers };

export default async function AdminMembersPage() {
  await requireAdmin();
  const isEmailConfigured = readResendConfig(process.env) !== null;

  const database = getDatabase();
  const [invites, members, waitingCount, badgeCount] = await Promise.all([
    readInvites(database, FIRST_PAGE, INVITE_FILTERS.all),
    readWaitingMembers(database),
    readWaitingMemberCount(database),
    readConfirmationBadgeCount(database, process.env),
  ]);

  const queryClient = new QueryClient();
  queryClient.setQueryData(inviteListQuery(FIRST_PAGE, INVITE_FILTERS.all).queryKey, invites);
  queryClient.setQueryData(waitingMembersQuery.queryKey, { members, waitingCount });

  return (
    <>
      <PageHeader title="Bring people in" description="Invites are personal: one link, for one person, used once." />
      <AdminTabs membersBadgeCount={badgeCount} />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <InviteManager isEmailConfigured={isEmailConfigured} />
      </HydrationBoundary>
    </>
  );
}
