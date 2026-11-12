import type { Metadata } from "next";

import { requireMember } from "@/platform/auth/session";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { ROUTES } from "@/platform/http/routes";
import { modulePage } from "@/platform/modules/module-page";
import { readDataHome } from "@/platform/settings/data-home";
import { EmailConfirmationNotice } from "@/modules/members/components/shared/email-confirmation-notice";
import { networkManifest } from "@/modules/network/manifest";
import { MyNetworkScreen } from "@/modules/network/components/my-network-screen";
import { readNetworkConnectedAt } from "@/modules/network/reads-progress";
import { OwnVillageLine } from "@/modules/network/components/own-village-line";
import { OWN_VILLAGE_STATES, readOwnVillageState } from "@/modules/network/reads-village-check";
import { loadWelcomeContext } from "@/shell/load-welcome-context";

export const metadata: Metadata = { title: PAGE_TITLES.myNetwork };

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Founderhall's My network: connect, sync and share the member's own network.
export default modulePage(networkManifest, async function MyNetworkPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [welcome, dataHome, connectedAt, ownVillage] = await Promise.all([
    loadWelcomeContext(database, member),
    readDataHome(database),
    readNetworkConnectedAt(database, member.id),
    readOwnVillageState(database, member.id),
  ]);
  const community = welcome.community.name;
  const contact = dataHome.contact?.email;
  const where = dataHome.location ? (
    `In ${dataHome.location}.`
  ) : (
    <>
      Ask {community} where the data is processed{contact ? <>: <a href={`mailto:${contact}`}>{contact}</a></> : null}.
    </>
  );
  return (
    <MyNetworkScreen
      communityName={community}
      processedLine={<>{where} You can stop sharing any time: you leave the community’s group in Village.</>}
      connectedAtLabel={connectedAt ? DAY_MONTH.format(connectedAt) : null}
      myProfileHref={`${ROUTES.editCard}#network`}
      emailConfirmation={<EmailConfirmationNotice welcome={welcome} />}
      villageLine={ownVillage ? <OwnVillageLine isConnected={ownVillage.state === OWN_VILLAGE_STATES.connected} checkedAt={ownVillage.checkedAt} /> : null}
      needsFullName={welcome.needsFullName ?? false}
    />
  );
});
