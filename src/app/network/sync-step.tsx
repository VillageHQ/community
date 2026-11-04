"use client";

import Script from "next/script";
import { useState } from "react";

import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { claimVillageBrowserSession } from "@/lib/village/browser-session";
import {
  NETWORK_STAGES,
  type NetworkStatus,
  type VillageSyncConfig,
} from "@/lib/village/network-api";

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

async function identifyMember({ publicKey, externalId }: VillageSyncConfig) {
  if (!window.Village) throw new Error("The Village SDK is missing.");
  claimVillageBrowserSession(externalId);
  window.Village.init(publicKey);
  await window.Village.identify(externalId);
}

type SdkState = "loading" | "identified" | "failed";

export function SyncStep({ status }: { status: NetworkStatus }) {
  const [sdkState, setSdkState] = useState<SdkState>("loading");
  const isSyncing = status.stage === NETWORK_STAGES.syncing;
  if (!status.sync) return null;
  const syncConfig = status.sync;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{isSyncing ? "Village is syncing your network" : "Sync your network"}</h2>
        </CardTitle>
        <CardDescription>
          {isSyncing
            ? "This can take a while. You can leave this page and come back."
            : "Connect your Village account in the popup. Allow popups for this site if your browser asks."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Script
          src={syncConfig.sdkUrl}
          onReady={() => {
            identifyMember(syncConfig).then(
              () => setSdkState("identified"),
              () => setSdkState("failed"),
            );
          }}
          onError={() => setSdkState("failed")}
        />
        {sdkState === "failed" ? <FormError message={SDK_LOAD_FAILURE_MESSAGE} /> : null}
        {sdkState === "identified" ? (
          <Button type="button" village-module="sync">
            {isSyncing ? "Open Village sync" : "Sync network"}
          </Button>
        ) : null}
        <p role="status" className="text-sm text-muted-foreground">
          {sdkState === "loading" ? "Loading Village…" : "We check your sync status every few seconds."}
        </p>
      </CardContent>
    </Card>
  );
}
