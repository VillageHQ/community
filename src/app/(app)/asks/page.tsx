import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { AsksScreen } from "@/modules/asks/components/asks-screen";
import { ASKS_PAGE_TITLE } from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { askBoardQuery, askCountsQuery, ownAsksQuery } from "@/modules/asks/queries";
import { readAskBoard, readNewOfferCount, readOwnAsks } from "@/modules/asks/reads";
import { parseAskBoardFilters } from "@/modules/asks/rules-board-url";
import { isAdminMember } from "@/platform/auth/roles";
import { requireMember } from "@/platform/auth/session";
import { getDatabase } from "@/platform/database/client";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: ASKS_PAGE_TITLE };

type AsksPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default modulePage(asksManifest, async function AsksPage({ searchParams }: AsksPageProps) {
  const member = await requireMember();
  const database = getDatabase();
  const { category } = parseAskBoardFilters(await searchParams);
  const [firstPage, ownAsks, newOffers] = await Promise.all([
    readAskBoard(database, { viewerId: member.id, category, cursor: null }),
    readOwnAsks(database, member.id),
    readNewOfferCount(database, member.id),
  ]);

  const queryClient = new QueryClient();
  queryClient.setQueryData(askBoardQuery(category).queryKey, { pages: [firstPage], pageParams: [null] });
  queryClient.setQueryData(ownAsksQuery().queryKey, ownAsks);
  queryClient.setQueryData(askCountsQuery().queryKey, { newOffers });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AsksScreen isViewerAdmin={isAdminMember(member)} />
    </HydrationBoundary>
  );
});
