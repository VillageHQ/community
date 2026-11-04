import type { Metadata } from "next";
import { getDatabase } from "@/database/client";
import { readBrandingForPage } from "@/lib/branding/branding";
import { ROUTES } from "@/lib/routes";
import { requireMember } from "@/lib/session";
import { isAdminMember } from "@/lib/village/member-network";
import {
  NETWORK_PROGRESS,
  readNetworkProgress,
  readSharingMemberCount,
  readWelcomeNeighbours,
} from "@/lib/village/network-progress";

import { ConsentStep } from "./consent-step";
import { LinkedinWelcome } from "./linkedin-step";
import { NetworkFlowLoader } from "./network-flow-loader";
import type { WelcomeContext } from "./welcome-context";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";

export const metadata: Metadata = { title: PAGE_TITLES.network };

export default async function NetworkPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [{ name, descriptor, logo }, progress, neighbours, sharingMemberCount] = await Promise.all([
    readBrandingForPage(),
    readNetworkProgress(database, member),
    readWelcomeNeighbours(database, member.id),
    readSharingMemberCount(database),
  ]);

  const welcome: WelcomeContext = {
    community: { name, descriptor, logo },
    member: { id: member.id, name: member.name },
    neighbours,
    sharingMemberCount,
    notNowHref: isAdminMember(member) ? ROUTES.admin : ROUTES.home,
  };

  if (progress === NETWORK_PROGRESS.needsLinkedin) return <LinkedinWelcome welcome={welcome} />;
  if (progress === NETWORK_PROGRESS.needsConsent) return <ConsentStep welcome={welcome} />;
  return <NetworkFlowLoader welcome={welcome} />;
}
