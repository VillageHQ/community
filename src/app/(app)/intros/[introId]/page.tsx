import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { QueryBoundary } from "@/components/query-boundary";
import { Button } from "@/components/ui/button";
import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { introDetailQuery } from "@/modules/intros/queries";
import { readIntroForViewer } from "@/modules/intros/reads";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";

import { IntroDetailView } from "@/modules/intros/components/intro-detail";
import { introsManifest } from "@/modules/intros/manifest";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.intro };

const introIdSchema = z.uuid();

export default modulePage(introsManifest, async function IntroPage({ params }: { params: Promise<{ introId: string }> }) {
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
        <QueryBoundary loadingMessage="Opening this intro request…">
          <IntroDetailView introId={intro.id} />
        </QueryBoundary>
      </HydrationBoundary>
    </div>
  );
});
