import type { Metadata } from "next";

import { requireMember } from "@/platform/auth/session";
import { readBrandingForPage } from "@/platform/branding/branding";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { getDatabase } from "@/platform/database/client";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";
import { readVillageKeys } from "@/platform/village/settings";
import { WEEKDAYS } from "@/platform/weekly-email/schedule";
import { readWeeklySchedule } from "@/platform/weekly-email/schedule-store";
import { readAvatarUrl } from "@/modules/members/service-profile";
import { asksManifest } from "@/modules/asks/manifest";
import { introsManifest } from "@/modules/intros/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { SEARCH_WHERE } from "@/modules/network/contract";
import { SEARCH_SCOPES } from "@/modules/network/contract-village-settings";
import { SearchScreen } from "@/modules/network/components/search-screen";
import { readIsInVillageGroup, readSharingMemberCount } from "@/modules/network/reads-progress";
import { readVillageSearchSettings } from "@/modules/network/service-settings";

export const metadata: Metadata = { title: PAGE_TITLES.network };

// Founderhall's Search: who you are trying to reach, through the networks members share.
export default modulePage(networkManifest, async function SearchPage() {
  const member = await requireMember();
  const database = getDatabase();
  const [branding, avatarUrl, sharingCount, isConnected, keys, settings, canAskIntro, canAskCommunity, schedule] = await Promise.all([
    readBrandingForPage(),
    readAvatarUrl(database, member.id),
    readSharingMemberCount(database),
    readIsInVillageGroup(database, member.id),
    readVillageKeys(database),
    readVillageSearchSettings(database),
    isModuleEnabled(database, introsManifest),
    isModuleEnabled(database, asksManifest),
    readWeeklySchedule(database),
  ]);
  return (
    <SearchScreen
      viewer={{ id: member.id, name: member.name, imageUrl: avatarUrl }}
      communityName={branding.name}
      sharingMemberCount={Math.max(sharingCount - (isConnected ? 1 : 0), 0)}
      isConnected={isConnected}
      isVillageOn={keys !== null}
      defaultScope={settings.searchScope === SEARCH_SCOPES.everyone ? SEARCH_WHERE.global : SEARCH_WHERE.network}
      canAskIntro={canAskIntro}
      canAskCommunity={canAskCommunity}
      digestDay={WEEKDAYS[schedule.weekday] ?? "Thursday"}
    />
  );
});
