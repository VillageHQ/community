"use client";

import { ErrorState, RetryButton } from "@/components/error-state";

export default function AppError({ retry }: { retry: () => void }) {
  return (
    <div className="rounded-panel bg-card shadow-panel">
      <ErrorState
        headingLevel="h1"
        title="This page didn't load"
        description="Something went wrong on our side. Try again, and if it keeps happening, tell your admin."
      >
        <RetryButton onClick={retry} />
      </ErrorState>
    </div>
  );
}
