import type { Metadata } from "next";
import type { ReactNode } from "react";

import { IntrosConnectorProvider } from "@/shell/intros-network-provider";
import { getDatabase } from "@/platform/database/client";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { requireMember } from "@/platform/auth/session";
import { NETWORK_PROGRESS, readNetworkProgress } from "@/modules/network/reads-progress";

import { ConsentStep } from "@/modules/network/components/consent-step";
import { LinkedinWelcome } from "@/modules/network/components/linkedin-step";
import { loadWelcomeContext } from "@/shell/load-welcome-context";
import { OwnVillageLine } from "@/modules/network/components/own-village-line";
import { OWN_VILLAGE_STATES, readOwnVillageState } from "@/modules/network/reads-village-check";
import { NetworkFlowLoader } from "@/modules/network/components/network-flow-loader";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { networkManifest } from "@/modules/network/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.network };

export default modulePage(networkManifest, async function NetworkPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [welcome, progress, ownVillage] = await Promise.all([
    loadWelcomeContext(database, member),
    readNetworkProgress(database, member),
    readOwnVillageState(database, member.id),
    resolveOnboardingStep(database, member),
  ]);
  const villageLine = ownVillage ? <OwnVillageLine isConnected={ownVillage.state === OWN_VILLAGE_STATES.connected} checkedAt={ownVillage.checkedAt} /> : null;
  const withLine = (content: ReactNode) => (
    <>
      {villageLine}
      {content}
    </>
  );

  if (progress === NETWORK_PROGRESS.needsLinkedin) return withLine(<LinkedinWelcome welcome={welcome} />);
  if (progress === NETWORK_PROGRESS.needsConsent) return withLine(<ConsentStep welcome={welcome} />);
  const flow = <NetworkFlowLoader welcome={welcome} />;
  return withLine((await isModuleEnabled(database, introsManifest)) ? <IntrosConnectorProvider>{flow}</IntrosConnectorProvider> : flow);
});
