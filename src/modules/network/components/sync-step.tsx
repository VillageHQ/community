"use client";

import { RefreshCw } from "lucide-react";
import Script from "next/script";
import { useState } from "react";

import type { ConstellationPerson } from "@/components/constellation";
import { FormError } from "@/components/form-error";
import { LoadingThread } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { claimVillageBrowserSession } from "@/platform/auth/browser-session";
import {
  NETWORK_STAGES,
  type NetworkStatus,
  type VillageSyncConfig,
} from "@/modules/network/contract";

import { JOIN_STEPS, JoinSteps } from "./join-steps";

const SDK_LOAD_FAILURE_MESSAGE =
  "Village's sync tool didn't load. Turn off any content blocker, then reload this page.";

declare global {
  interface Window {
    Village?: {
      init: (publicKey: string) => unknown;
      identify: (memberId: string) => Promise<void>;
    };
  }
}

type SdkState = "loading" | "identified" | "failed";

async function identifyMember(
  { publicKey, externalId }: VillageSyncConfig,
  setSdkState: (sdkState: SdkState) => void,
) {
  try {
    if (!window.Village) throw new Error("The Village SDK is missing.");
    claimVillageBrowserSession(externalId);
    window.Village.init(publicKey);
    await window.Village.identify(externalId);
    setSdkState("identified");
  } catch {
    setSdkState("failed");
  }
}

export function SyncStep({ status, member }: { status: NetworkStatus; member: ConstellationPerson }) {
  const [sdkState, setSdkState] = useState<SdkState>("loading");
  const isSyncing = status.stage === NETWORK_STAGES.syncing;
  if (!status.sync) return null;
  const syncConfig = status.sync;

  return (
    <>
      <JoinSteps current={JOIN_STEPS.sync} />
      <h1 className="type-h1">{isSyncing ? "Village is syncing your network" : "Sync your network"}</h1>
      <p className="type-lead mt-1.5 text-foreground-soft">
        {isSyncing
          ? "This can take a while. You can leave this page and come back."
          : "Connect your Village account in the popup. Allow popups for this site if your browser asks."}
      </p>
      <div className="mt-6 flex flex-col items-center rounded-panel bg-card px-5 py-10 text-center shadow-panel sm:px-10 sm:py-14">
        <LoadingThread person={member} />
        <Script
          src={syncConfig.sdkUrl}
          onReady={() => void identifyMember(syncConfig, setSdkState)}
          onError={() => setSdkState("failed")}
        />
        {sdkState === "failed" ? <FormError message={SDK_LOAD_FAILURE_MESSAGE} /> : null}
        {sdkState === "identified" ? (
          <Button type="button" size="hero" village-module="sync">
            <RefreshCw aria-hidden="true" />
            {isSyncing ? "Open Village sync" : "Sync network"}
          </Button>
        ) : null}
        <p role="status" className="type-small mt-4 text-muted-foreground">
          {sdkState === "loading" ? "Loading Village…" : "We check your sync status every few seconds."}
        </p>
      </div>
    </>
  );
}
