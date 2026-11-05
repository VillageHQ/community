import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/database/client";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { introDetailQuery } from "@/lib/intros/intro-queries";
import { readIntroForViewer } from "@/lib/intros/intro-reads";
import { ROUTES } from "@/lib/routes";
import { requireMember } from "@/lib/session";

import { IntroDetailView } from "./intro-detail";

export const metadata: Metadata = { title: PAGE_TITLES.intro };

const introIdSchema = z.uuid();

export default async function IntroPage({ params }: { params: Promise<{ introId: string }> }) {
  const member = await requireMember();
  const parsedId = introIdSchema.safeParse((await params).introId);
  if (!parsedId.success) notFound();

  const intro = await readIntroForViewer(getDatabase(), member.id, parsedId.data);
  if (!intro) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(introDetailQuery(intro.id).queryKey, intro);

  return (
    <div className="mx-auto grid max-w-[720px] gap-4">
      <div>
        <Button asChild variant="quiet" size="sm">
          <Link href={ROUTES.intros}>
            <ArrowLeft aria-hidden="true" />
            All intros
          </Link>
        </Button>
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <QueryBoundary loadingMessage="Opening this ask…">
          <IntroDetailView introId={intro.id} />
        </QueryBoundary>
      </HydrationBoundary>
    </div>
  );
}
