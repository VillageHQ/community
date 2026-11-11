"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BatteryLow, Clock, CloudOff, RefreshCw, type LucideIcon } from "lucide-react";
import { useEffect } from "react";
import type { FallbackProps } from "react-error-boundary";

import { Note } from "@/components/ui/note";
import { Button } from "@/components/ui/button";
import { NETWORK_ERROR_CODES } from "@/modules/network/contract";
import { RequestFailure } from "@/platform/http/post-request";

import { NETWORK_QUERY_KEYS } from "@/modules/network/queries";

const FALLBACK_MESSAGE = "Something went wrong. Try again.";

type WarmStep = { icon: LucideIcon; title: string; description: string; action: string | null };

// Village down, slow or refusing the keys: nothing the member did, so a calm note, never an error.
const SEARCH_UNAVAILABLE: WarmStep = {
  icon: CloudOff,
  title: "Search is unavailable right now",
  description: "Village, the service behind network search, isn't answering. Your admin can see this, so you don't need to do anything. Everything else here works as usual.",
  action: "Check again",
};

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
  [NETWORK_ERROR_CODES.outOfCredits]: {
    icon: BatteryLow,
    title: "Lookups are paused for now",
    description: "This community has run out of Village credits. Your admin can see this and add more, so you don't need to do anything. Everything you already opened is still here.",
    action: "Check again",
  },
  [NETWORK_ERROR_CODES.unavailable]: SEARCH_UNAVAILABLE,
  [NETWORK_ERROR_CODES.timedOut]: SEARCH_UNAVAILABLE,
  [NETWORK_ERROR_CODES.keysRejected]: SEARCH_UNAVAILABLE,
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

  // Founderhall's search error: one note in member words, in the results' place.
  const warmStep = code === null ? undefined : WARM_STEPS[code];
  if (warmStep) {
    return (
      <div role="status" className="mt-4">
        <Note kind="needs" icon={warmStep.icon}>
          <b>{warmStep.title}.</b> {warmStep.description}
        </Note>
        {warmStep.action ? (
          <div className="fh-btn-row mt-2.5">
            <Button type="button" variant="quiet" size="sm" onClick={resetErrorBoundary}>
              {warmStep.action}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div role="alert" className="mt-4">
      <Note kind="needs">{readFailureMessage(error)}</Note>
      <div className="fh-btn-row mt-2.5">
        <Button type="button" variant="quiet" size="sm" onClick={resetErrorBoundary}>
          Try again
        </Button>
      </div>
    </div>
  );
}
