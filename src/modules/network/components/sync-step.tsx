"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openSyncModal } from "@villagehq/sdk";
import { RefreshCw } from "lucide-react";

import type { ConstellationPerson } from "@/components/constellation";
import { FormError } from "@/components/form-error";
import { LoadingThread } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { postRequest } from "@/platform/http/post-request";
import { API_ROUTES } from "@/platform/http/routes";
import { NETWORK_STAGES, syncTokenSchema, type NetworkStatus } from "@/modules/network/contract";
import { networkStatusQuery } from "@/modules/network/queries";

import { JOIN_STEPS, JoinSteps } from "./join-steps";

async function openVillageSync(appUrl: string) {
  const { token } = await postRequest(API_ROUTES.networkSyncToken, {}, syncTokenSchema);
  await openSyncModal({ token, appUrl });
}

export function SyncStep({ status, member }: { status: NetworkStatus; member: ConstellationPerson }) {
  const queryClient = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: openVillageSync,
    onSettled: () => queryClient.invalidateQueries({ queryKey: networkStatusQuery.queryKey }),
  });
  const isSyncing = status.stage === NETWORK_STAGES.syncing;
  if (!status.sync) return null;
  const { appUrl } = status.sync;

  return (
    <>
      <JoinSteps current={JOIN_STEPS.sync} />
      <h1 className="type-h1">{isSyncing ? "Village is syncing your network" : "Sync your network"}</h1>
      <p className="type-lead mt-1.5 text-foreground-soft">
        {isSyncing
          ? "This can take a while. You can leave this page and come back."
          : "Connect your accounts in Village's window. Allow popups for this site if your browser asks."}
      </p>
      <div className="mt-6 flex flex-col items-center rounded-panel bg-card px-5 py-10 text-center shadow-panel sm:px-10 sm:py-14">
        <LoadingThread person={member} />
        <FormError message={syncMutation.error?.message ?? null} />
        <Button type="button" size="hero" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate(appUrl)}>
          <RefreshCw aria-hidden="true" />
          {isSyncing ? "Open Village sync" : "Sync network"}
        </Button>
        <p role="status" className="type-small mt-4 text-muted-foreground">
          {syncMutation.isPending ? "Village's sync window is open." : "We check your sync status every few seconds."}
        </p>
      </div>
    </>
  );
}
