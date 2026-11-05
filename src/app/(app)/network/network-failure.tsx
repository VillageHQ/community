"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Clock, RefreshCw, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import type { FallbackProps } from "react-error-boundary";

import { EmptyState } from "@/components/empty-state";
import { ErrorState, RetryButton } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { NETWORK_ERROR_CODES } from "@/lib/village/network-api";
import { RequestFailure } from "@/lib/village/post-network-request";

import { NETWORK_QUERY_KEYS } from "./network-queries";

const FALLBACK_MESSAGE = "Something went wrong. Try again.";
const FAILURE_TITLE = "That didn't work";

type WarmStep = { icon: LucideIcon; title: string; description: string; action: string | null };

const WARM_STEPS: Record<string, WarmStep> = {
  [NETWORK_ERROR_CODES.notSynced]: {
    icon: RefreshCw,
    title: "Your network is still syncing",
    description: "Village is still reading your connections. Check back in a few minutes.",
    action: "Check again",
  },
  [NETWORK_ERROR_CODES.dailyLimitReached]: {
    icon: Clock,
    title: "That's today's lookups",
    description: "You've used today's lookups. They come back tomorrow, and everything you already opened is still here.",
    action: null,
  },
};

const STAGE_CHANGING_CODES: ReadonlySet<string> = new Set([
  NETWORK_ERROR_CODES.notReady,
  NETWORK_ERROR_CODES.notLinked,
  NETWORK_ERROR_CODES.emailNotConfirmed,
  NETWORK_ERROR_CODES.linkMismatch,
]);

function readFailureCode(error: unknown) {
  return error instanceof RequestFailure ? error.code : null;
}

function readFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}

export function NetworkFailure({ error, resetErrorBoundary }: FallbackProps) {
  const queryClient = useQueryClient();
  const code = readFailureCode(error);
  const isStageChanging = code !== null && STAGE_CHANGING_CODES.has(code);

  useEffect(() => {
    if (isStageChanging) void queryClient.invalidateQueries({ queryKey: [NETWORK_QUERY_KEYS.status] });
  }, [isStageChanging, queryClient]);

  const warmStep = code === null ? undefined : WARM_STEPS[code];
  if (warmStep) {
    return (
      <div role="status" className="rounded-field bg-muted">
        <EmptyState icon={warmStep.icon} title={warmStep.title} description={warmStep.description} headingLevel="h3">
          {warmStep.action ? (
            <Button type="button" size="lg" onClick={resetErrorBoundary}>
              {warmStep.action}
            </Button>
          ) : null}
        </EmptyState>
      </div>
    );
  }

  return (
    <ErrorState title={FAILURE_TITLE} description={readFailureMessage(error)} headingLevel="h3">
      <RetryButton onClick={resetErrorBoundary} />
    </ErrorState>
  );
}
