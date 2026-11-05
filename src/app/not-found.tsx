import type { Metadata } from "next";
import { Compass } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { CenteredPage } from "@/components/centered-page";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { readBrandingForPage } from "@/platform/branding/branding";
import { ROUTES } from "@/platform/http/routes";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";

export const metadata: Metadata = { title: PAGE_TITLES.notFound };

export default async function NotFound() {
  await connection();
  const { name, logo } = await readBrandingForPage();
  return (
    <CenteredPage name={name} logo={logo}>
      <EmptyState
        headingLevel="h1"
        icon={Compass}
        title="We can't find that page"
        description="The link may be old, or the page may have moved."
      >
        <Button asChild size="lg">
          <Link href={ROUTES.feed}>Go to the feed</Link>
        </Button>
      </EmptyState>
    </CenteredPage>
  );
}
