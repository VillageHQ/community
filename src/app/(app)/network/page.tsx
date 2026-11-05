import type { Metadata } from "next";

import { IntrosConnectorProvider } from "@/modules/intros/components/connector-ask";
import { getDatabase } from "@/platform/database/client";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { requireMember } from "@/platform/auth/session";
import { NETWORK_PROGRESS, readNetworkProgress } from "@/modules/network/reads-progress";

import { ConsentStep } from "@/modules/network/components/consent-step";
import { LinkedinWelcome } from "@/modules/network/components/linkedin-step";
import { loadWelcomeContext } from "@/shell/load-welcome-context";
import { NetworkFlowLoader } from "@/modules/network/components/network-flow-loader";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { networkManifest } from "@/modules/network/manifest";
import { modulePage } from "@/platform/modules/module-page";

export const metadata: Metadata = { title: PAGE_TITLES.network };

export default modulePage(networkManifest, async function NetworkPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [welcome, progress] = await Promise.all([
    loadWelcomeContext(database, member),
    readNetworkProgress(database, member),
    resolveOnboardingStep(database, member),
  ]);

  if (progress === NETWORK_PROGRESS.needsLinkedin) return <LinkedinWelcome welcome={welcome} />;
  if (progress === NETWORK_PROGRESS.needsConsent) return <ConsentStep welcome={welcome} />;
  return (
    <IntrosConnectorProvider>
      <NetworkFlowLoader welcome={welcome} />
    </IntrosConnectorProvider>
  );
});
