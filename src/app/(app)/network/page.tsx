import type { Metadata } from "next";
import { getDatabase } from "@/database/client";
import { resolveOnboardingStep } from "@/lib/members/onboarding";
import { requireMember } from "@/lib/session";
import { NETWORK_PROGRESS, readNetworkProgress } from "@/lib/village/network-progress";

import { ConsentStep } from "./consent-step";
import { LinkedinWelcome } from "./linkedin-step";
import { loadWelcomeContext } from "./load-welcome-context";
import { NetworkFlowLoader } from "./network-flow-loader";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";

export const metadata: Metadata = { title: PAGE_TITLES.network };

export default async function NetworkPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [welcome, progress] = await Promise.all([
    loadWelcomeContext(database, member),
    readNetworkProgress(database, member),
    resolveOnboardingStep(database, member),
  ]);

  if (progress === NETWORK_PROGRESS.needsLinkedin) return <LinkedinWelcome welcome={welcome} />;
  if (progress === NETWORK_PROGRESS.needsConsent) return <ConsentStep welcome={welcome} />;
  return <NetworkFlowLoader welcome={welcome} />;
}
