"use client";

import { PageCard } from "@/components/page-card";
import { Button } from "@/components/ui/button";

const TROUBLESHOOTING_URL = "https://github.com/VillageHQ/community#troubleshooting";

export default function ErrorBoundary({ retry }: { retry: () => void }) {
  return (
    <PageCard
      title="Something went wrong"
      description="This page failed to load. The app may not be able to reach its database, or it may still be preparing it."
    >
      <p className="text-sm">
        If you run this site, see{" "}
        <a className="underline" href={TROUBLESHOOTING_URL}>
          Troubleshooting in the README
        </a>
        .
      </p>
      <Button onClick={retry}>Try again</Button>
    </PageCard>
  );
}
