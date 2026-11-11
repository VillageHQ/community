"use client";

import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, KeyRound, ShieldAlert, UsersRound } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { QueryBoundary } from "@/components/query-boundary";
import { ROUTES } from "@/platform/http/routes";
import { NETWORK_STAGES, type NetworkStatus } from "@/modules/network/contract";

import { ConsentStep } from "./consent-step";
import { EmailConfirmationNotice } from "@/modules/members/components/shared/email-confirmation-notice";
import { LinkedinWelcome } from "./linkedin-step";
import { NetworkFailure } from "./network-failure";
import { NetworkSkeleton } from "./network-skeleton";
import { activeSearchQuery, NETWORK_QUERY_KEYS, networkStatusQuery } from "@/modules/network/queries";
import { ConnectInvitation } from "./connect-invitation";
import { NetworkSearch } from "./network-search";
import { NoticeCard } from "./notice-card";
import { SyncStep } from "./sync-step";
import type { WelcomeContext } from "@/modules/members/components/shared/welcome-context";

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
      href={ROUTES.adminSetup}
      action="Open admin setup"
    />
  );
}

function renderLinkMismatch({ isAdmin }: NetworkStatus) {
  if (!isAdmin) {
    return (
      <NoticeCard
        icon={ShieldAlert}
        title="Your Village account needs an admin's approval"
        description="The Village account linked to you uses a different email from your account here. You can't join, search or see paths until an admin approves it. If you didn't mean to link that account, tell your admin."
      />
    );
  }
  return (
    <NoticeCard
      icon={ShieldAlert}
      title="Approve your Village account"
      description="The Village account linked to you uses a different email from your account here. As an admin, you can approve it yourself: open Manage on your row in Members. Approve only if both emails are yours."
      href={ROUTES.adminMembers}
      action="Open Members"
    />
  );
}

const STAGE_VIEWS: Record<NetworkStatus["stage"], (status: NetworkStatus, welcome: WelcomeContext) => ReactNode> = {
  [NETWORK_STAGES.notConfigured]: renderNotConfigured,
  [NETWORK_STAGES.needsEmailConfirmation]: (_status, welcome) => (
    <div className="rounded-panel bg-card shadow-panel">
      <EmailConfirmationNotice welcome={welcome} />
    </div>
  ),
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
      href={ROUTES.adminSetup}
      action="Open admin setup"
    />
  ),
  [NETWORK_STAGES.linkMismatch]: renderLinkMismatch,
  [NETWORK_STAGES.ready]: (_status, welcome) => <NetworkSearch welcome={welcome} />,
};

// Results found before the member connected covered only the shared networks. Once they're in, those results are
// cleared, so the next search, and every path, counts their own contacts too.
function useForgetPooledResults(status: NetworkStatus) {
  const queryClient = useQueryClient();
  const wasPooled = useRef(false);
  const isPooled = status.canSearch && status.stage !== NETWORK_STAGES.ready;
  useEffect(() => {
    if (isPooled) wasPooled.current = true;
    if (isPooled || !wasPooled.current || status.stage !== NETWORK_STAGES.ready) return;
    wasPooled.current = false;
    queryClient.removeQueries({ queryKey: [NETWORK_QUERY_KEYS.search] });
    queryClient.removeQueries({ queryKey: [NETWORK_QUERY_KEYS.paths] });
    queryClient.setQueryData(activeSearchQuery.queryKey, null);
  }, [isPooled, status.stage, queryClient]);
}

// Once a member opens "Add your network", the steps stay open across the one reload the LinkedIn step does. The mark is
// read once, so coming back to the page later, after "Not now", shows the search again.
const CONNECTING_KEY = "network-connecting";

function useConnecting() {
  const [isConnecting, setIsConnecting] = useState(() => window.sessionStorage.getItem(CONNECTING_KEY) === "true");
  useEffect(() => window.sessionStorage.removeItem(CONNECTING_KEY), []);
  const startConnecting = () => {
    window.sessionStorage.setItem(CONNECTING_KEY, "true");
    setIsConnecting(true);
  };
  return [isConnecting, startConnecting] as const;
}

function CurrentStage({ welcome }: { welcome: WelcomeContext }) {
  const { data: status } = useSuspenseQuery(networkStatusQuery);
  useForgetPooledResults(status);
  const [isConnecting, startConnecting] = useConnecting();
  if (status.stage === NETWORK_STAGES.ready || !status.canSearch || isConnecting) {
    return STAGE_VIEWS[status.stage](status, welcome);
  }
  return <NetworkSearch welcome={welcome} invitation={<ConnectInvitation stage={status.stage} onOpen={startConnecting} />} />;
}

export function NetworkFlow({ welcome }: { welcome: WelcomeContext }) {
  return (
    <QueryBoundary loadingMessage="Checking your network…" fallback={<NetworkSkeleton />} failure={NetworkFailure}>
      <CurrentStage welcome={welcome} />
    </QueryBoundary>
  );
}
