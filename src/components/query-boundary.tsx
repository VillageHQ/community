"use client";

import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

const FALLBACK_ERROR_MESSAGE = "Something went wrong. Try again.";

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : FALLBACK_ERROR_MESSAGE;
}

function QueryFailure({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="grid gap-2">
      <FormError message={readErrorMessage(error)} />
      <Button type="button" variant="outline" onClick={resetErrorBoundary}>
        Try again
      </Button>
    </div>
  );
}

type QueryBoundaryProps = { loadingMessage: string; children: ReactNode };

export function QueryBoundary({ loadingMessage, children }: QueryBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary FallbackComponent={QueryFailure} onReset={reset}>
          <Suspense
            fallback={
              <p role="status" className="text-sm text-muted-foreground">
                {loadingMessage}
              </p>
            }
          >
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
