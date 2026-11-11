import type { Metadata } from "next";

import { IntrosConnectorProvider } from "@/modules/intros/components/connector-ask";
import { getDatabase } from "@/platform/database/client";
import { resolveOnboardingStep } from "@/shell/onboarding";
import { requireMember } from "@/platform/auth/session";
import { loadWelcomeContext } from "@/shell/load-welcome-context";
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
  // The flow picks the view: search at once when there is something to search (an invitation to connect beside it),
  // else the LinkedIn, sharing and sync steps.
  const [welcome] = await Promise.all([loadWelcomeContext(database, member), resolveOnboardingStep(database, member)]);
  const flow = <NetworkFlowLoader welcome={welcome} />;
  return (await isModuleEnabled(database, introsManifest)) ? <IntrosConnectorProvider>{flow}</IntrosConnectorProvider> : flow;
});
