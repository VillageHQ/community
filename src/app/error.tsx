"use client";

import { ErrorState, RetryButton } from "@/components/error-state";
import { MAIN_CONTENT_ID } from "@/components/skip-link";

const TROUBLESHOOTING_URL = "https://github.com/VillageHQ/community#troubleshooting";

export default function ErrorBoundary({ retry }: { retry: () => void }) {
  return (
    <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-h-dvh items-center justify-center px-3.5 py-10">
      <div className="w-full max-w-[640px] rounded-panel bg-card shadow-panel">
        <ErrorState
          headingLevel="h1"
          title="Something went wrong"
          description="This page failed to load. The app may not be able to reach its database, or it may still be preparing it."
        >
          <RetryButton onClick={retry} />
          <p className="type-small text-foreground-soft">
            If you run this site, see{" "}
            <a className="font-bold text-brand-emphasis underline" href={TROUBLESHOOTING_URL}>
              Troubleshooting in the README
            </a>
            .
          </p>
        </ErrorState>
      </div>
    </main>
  );
}
