"use client";

import { QueryClient, QueryClientProvider, useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";

import { QueryBoundary } from "@/components/query-boundary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/lib/routes";
import { NETWORK_STAGES, type NetworkStatus } from "@/lib/village/network-api";

import { ConsentStep } from "./consent-step";
import { LinkedinStep } from "./linkedin-step";
import { networkStatusQuery } from "./network-queries";
import { NetworkSearch } from "./network-search";
import { SyncStep } from "./sync-step";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function NoticeCard({ title, description, href, action }: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {href ? (
        <CardContent>
          <Link className="text-sm underline" href={href}>
            {action}
          </Link>
        </CardContent>
      ) : null}
    </Card>
  );
}

function renderNotConfigured({ isAdmin }: NetworkStatus) {
  if (!isAdmin) {
    return (
      <NoticeCard
        title="Village isn't connected yet"
        description="An admin needs to connect this community to Village first."
      />
    );
  }
  return (
    <NoticeCard
      title="Connect Village"
      description="Paste your Village keys to turn on network search."
      href={ROUTES.villageSettings}
      action="Open Village settings"
    />
  );
}

const STAGE_VIEWS: Record<NetworkStatus["stage"], (status: NetworkStatus) => React.ReactNode> = {
  [NETWORK_STAGES.notConfigured]: renderNotConfigured,
  [NETWORK_STAGES.needsLinkedin]: () => <LinkedinStep />,
  [NETWORK_STAGES.awaitingGroup]: () => (
    <NoticeCard
      title="The community group isn't ready"
      description="An admin needs to create the group before you can join. Check back soon."
    />
  ),
  [NETWORK_STAGES.needsConsent]: () => <ConsentStep />,
  [NETWORK_STAGES.needsSync]: (status) => <SyncStep status={status} />,
  [NETWORK_STAGES.syncing]: (status) => <SyncStep status={status} />,
  [NETWORK_STAGES.needsGroupCreation]: () => (
    <NoticeCard
      title="Create the community group"
      description="Your network is synced. Create the group so members can join."
      href={ROUTES.villageSettings}
      action="Open Village settings"
    />
  ),
  [NETWORK_STAGES.linkMismatch]: () => (
    <NoticeCard
      title="Your Village account needs an admin's approval"
      description="The Village account linked to you uses a different email from your account here. You can't join, search or see paths until an admin approves it. If you didn't mean to link that account, tell your admin."
    />
  ),
  [NETWORK_STAGES.ready]: () => <NetworkSearch />,
};

function CurrentStage() {
  const { data: status } = useSuspenseQuery(networkStatusQuery);
  return STAGE_VIEWS[status.stage](status);
}

export function NetworkFlow() {
  return (
    <QueryClientProvider client={queryClient}>
      <QueryBoundary loadingMessage="Checking your network…">
        <CurrentStage />
      </QueryBoundary>
    </QueryClientProvider>
  );
}
