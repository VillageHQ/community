"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Clock, KeyRound, ShieldAlert, UsersRound } from "lucide-react";
import type { ReactNode } from "react";

import { QueryBoundary } from "@/components/query-boundary";
import { ROUTES } from "@/lib/routes";
import { NETWORK_STAGES, type NetworkStatus } from "@/lib/village/network-api";

import { ConsentStep } from "./consent-step";
import { LinkedinWelcome } from "./linkedin-step";
import { NetworkSkeleton } from "./network-skeleton";
import { networkStatusQuery } from "./network-queries";
import { NetworkSearch } from "./network-search";
import { NoticeCard } from "./notice-card";
import { SyncStep } from "./sync-step";
import type { WelcomeContext } from "./welcome-context";

function renderNotConfigured({ isAdmin }: NetworkStatus) {
  if (!isAdmin) {
    return (
      <NoticeCard
        icon={KeyRound}
        title="Village isn't connected yet"
        description="An admin needs to connect this community to Village first."
      />
    );
  }
  return (
    <NoticeCard
      icon={KeyRound}
      title="Connect Village"
      description="Paste your Village keys to turn on network search."
      href={ROUTES.admin}
      action="Open admin setup"
    />
  );
}

const STAGE_VIEWS: Record<NetworkStatus["stage"], (status: NetworkStatus, welcome: WelcomeContext) => ReactNode> = {
  [NETWORK_STAGES.notConfigured]: renderNotConfigured,
  [NETWORK_STAGES.needsLinkedin]: (_status, welcome) => <LinkedinWelcome welcome={welcome} />,
  [NETWORK_STAGES.awaitingGroup]: () => (
    <NoticeCard
      icon={Clock}
      title="The community group isn't ready"
      description="An admin needs to create the group before you can join. Check back soon."
    />
  ),
  [NETWORK_STAGES.needsConsent]: (_status, welcome) => <ConsentStep welcome={welcome} />,
  [NETWORK_STAGES.needsSync]: (status, { member }) => <SyncStep status={status} member={member} />,
  [NETWORK_STAGES.syncing]: (status, { member }) => <SyncStep status={status} member={member} />,
  [NETWORK_STAGES.needsGroupCreation]: () => (
    <NoticeCard
      icon={UsersRound}
      title="Create the community group"
      description="Your network is synced. Create the group so members can join."
      href={ROUTES.admin}
      action="Open admin setup"
    />
  ),
  [NETWORK_STAGES.linkMismatch]: () => (
    <NoticeCard
      icon={ShieldAlert}
      title="Your Village account needs an admin's approval"
      description="The Village account linked to you uses a different email from your account here. You can't join, search or see paths until an admin approves it. If you didn't mean to link that account, tell your admin."
    />
  ),
  [NETWORK_STAGES.ready]: (_status, welcome) => <NetworkSearch welcome={welcome} />,
};

function CurrentStage({ welcome }: { welcome: WelcomeContext }) {
  const { data: status } = useSuspenseQuery(networkStatusQuery);
  return STAGE_VIEWS[status.stage](status, welcome);
}

export function NetworkFlow({ welcome }: { welcome: WelcomeContext }) {
  return (
    <QueryBoundary loadingMessage="Checking your network…" fallback={<NetworkSkeleton />}>
      <CurrentStage welcome={welcome} />
    </QueryBoundary>
  );
}
