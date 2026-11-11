import type { SearchWhere } from "@/modules/network/contract";

export type SearchViewer = { id: string; name: string; imageUrl: string | null };

export type SearchScreenProps = {
  viewer: SearchViewer;
  communityName: string;
  // Members other than the viewer who share their network.
  sharingMemberCount: number;
  // The viewer's own network is in (they joined and synced).
  isConnected: boolean;
  // Village is connected for this community; without it search finds member profiles only.
  isVillageOn: boolean;
  defaultScope: SearchWhere;
  canAskIntro: boolean;
  canAskCommunity: boolean;
  digestDay: string;
};
