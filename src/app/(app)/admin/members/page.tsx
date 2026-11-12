import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { ChipCount, ChipRow, CHIP_CLASSES } from "@/components/ui/chip";
import { Button, ButtonRow } from "@/components/ui/button";
import { SearchBox } from "@/components/ui/search-box";
import { getDatabase } from "@/platform/database/client";
import { readBranding } from "@/platform/branding/branding";
import { readResendConfig } from "@/platform/email/resend";
import { ROUTES } from "@/platform/http/routes";
import { requireAdmin } from "@/platform/auth/session";
import { modulePage } from "@/platform/modules/module-page";

import { MAXIMUM_SEARCH_LENGTH } from "@/modules/admin/contract";
import {
  ALWAYS_SHOWN_FILTERS,
  CONSOLE_MEMBER_FILTER_LABELS,
  countConsoleMembers,
  matchesConsoleFilter,
  matchesConsoleSearch,
  MEMBERS_LEGEND,
  parseConsoleMemberFilter,
  SHOWN_WHEN_FULL_FILTERS,
  sortConsoleMembers,
  type ConsoleMemberFilter,
} from "@/modules/admin/console-members";
import { readConsoleMembers } from "@/modules/admin/reads-members";
import { MemberTable } from "@/modules/admin/components/member-table";
import { WaitingMembers } from "@/modules/admin/components/waiting-members";
import { readWaitingMemberCount, readWaitingMembers } from "@/modules/members/service-admin";
import { waitingMembersQuery } from "@/modules/members/queries-invites";
import { LinkedinClaimCard } from "@/modules/members/components/shared/linkedin-claim-card";
import { adminManifest } from "@/modules/admin/manifest";

// Founderhall's Import members page (Set up). Built by the Set up pages; Members only links to it.
const IMPORT_PAGE = "/admin/import";

export const metadata: Metadata = { title: "Members" };

function filterHref(filter: ConsoleMemberFilter, search: string) {
  const query = new URLSearchParams({ f: filter, ...(search ? { q: search } : {}) });
  return `${ROUTES.adminMembers}?${query}`;
}

type MembersSearch = { f?: string; q?: string };

// Founderhall's Members: everyone in one table, members and the people invited, with filters and a search.
// Community-only tools stay: each member's Manage page (role, Village, LinkedIn, remove, delete), the people waiting
// for an OK, and freeing up a LinkedIn profile.
export default modulePage(adminManifest, async function AdminMembersPage({ searchParams }: { searchParams: Promise<MembersSearch> }) {
  await requireAdmin();
  const { f, q } = await searchParams;
  const filter = parseConsoleMemberFilter(f);
  const search = (q ?? "").trim().slice(0, MAXIMUM_SEARCH_LENGTH);

  const database = getDatabase();
  const [everyone, branding, waiting, waitingCount] = await Promise.all([
    readConsoleMembers(database),
    readBranding(database),
    readWaitingMembers(database),
    readWaitingMemberCount(database),
  ]);
  const counts = countConsoleMembers(everyone);
  const shown = sortConsoleMembers(everyone.filter((member) => matchesConsoleFilter(member, filter) && matchesConsoleSearch(member, search)));
  const filters = [...ALWAYS_SHOWN_FILTERS, ...SHOWN_WHEN_FULL_FILTERS.filter((extra) => counts[extra] > 0 || extra === filter)];

  const queryClient = new QueryClient();
  queryClient.setQueryData(waitingMembersQuery.queryKey, { members: waiting, waitingCount });

  return (
    <>
      <div className="fh-pagehead">
        <div className="fh-row">
          <div className="min-w-60 flex-1">
            <h1 className="fh-h1">Members</h1>
            <p className="fh-lede">
              {counts.all} people in {branding.name}. Members write their own profiles; only admins see email addresses.
            </p>
          </div>
          <ButtonRow>
            <Button asChild size="sm">
              <Link href={ROUTES.adminInvites}>
                <Plus aria-hidden="true" strokeWidth={1.5} />
                Add members
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={IMPORT_PAGE}>Import a CSV</Link>
            </Button>
          </ButtonRow>
        </div>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <WaitingMembers isEmailConfigured={readResendConfig(process.env) !== null} />
      </HydrationBoundary>

      <ChipRow role="group" aria-label="Filter members">
        {filters.map((key) => (
          <Link key={key} href={filterHref(key, search)} className={CHIP_CLASSES} aria-pressed={filter === key}>
            {CONSOLE_MEMBER_FILTER_LABELS[key]} <ChipCount>{counts[key]}</ChipCount>
          </Link>
        ))}
      </ChipRow>

      <form method="get" action={ROUTES.adminMembers} role="search" className="mt-3.5 mb-1.5">
        <input type="hidden" name="f" value={filter} />
        <SearchBox name="q" placeholder="Name, email, company or city" defaultValue={search} aria-label="Search members" maxLength={MAXIMUM_SEARCH_LENGTH} className="[&_.fh-input]:h-11" />
      </form>

      <MemberTable members={shown} empty={<EmptyState title="Nobody here" description="Try another filter." />} />

      <p className="fh-small fh-muted mt-3">{MEMBERS_LEGEND}</p>

      <details className="fh-copybox mt-7">
        <summary>Free up a LinkedIn profile</summary>
        <div className="mt-3">
          <LinkedinClaimCard />
        </div>
      </details>
    </>
  );
});
