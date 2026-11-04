"use client";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { ErrorState, RetryButton } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";

const FALLBACK_ERROR_MESSAGE = "Something went wrong. Try again.";
const FAILURE_TITLE = "That didn't work";

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE;
}

function QueryFailure({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <ErrorState title={FAILURE_TITLE} description={readErrorMessage(error)}>
      <RetryButton onClick={resetErrorBoundary} />
    </ErrorState>
  );
}

type QueryBoundaryProps = { loadingMessage: string; fallback?: ReactNode; children: ReactNode };

export function QueryBoundary({ loadingMessage, fallback, children }: QueryBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary FallbackComponent={QueryFailure} onReset={reset}>
          <Suspense fallback={fallback ?? <LoadingState title={loadingMessage} />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
