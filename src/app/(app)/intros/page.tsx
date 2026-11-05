import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { QueryBoundary } from "@/components/query-boundary";
import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { introBoardQuery } from "@/modules/intros/queries";
import { readIntroBoard } from "@/modules/intros/reads";
import { requireMember } from "@/platform/auth/session";

import { IntroBoardView } from "@/modules/intros/components/intro-board";

export const metadata: Metadata = { title: PAGE_TITLES.intros };

export default async function IntrosPage() {
  const member = await requireMember();
  const queryClient = new QueryClient();
  queryClient.setQueryData(introBoardQuery().queryKey, await readIntroBoard(getDatabase(), member.id));

  return (
    <>
      <PageHeader title="Intros" description="The warm way to meet someone: one person who knows them, saying yes first." />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QueryBoundary loadingMessage="Finding your intros…">
          <IntroBoardView />
        </QueryBoundary>
      </HydrationBoundary>
    </>
  );
}
