import { VILLAGE_STATUSES } from "../admin/admin-api.ts";

type VillageStatusFacts = {
  pendingVillageEmail: string | null;
  groupJoinedAt: Date | null;
  villageLinkedAt: Date | null;
  sharingConsentedAt: Date | null;
};

export function readVillageStatus({ pendingVillageEmail, groupJoinedAt, villageLinkedAt, sharingConsentedAt }: VillageStatusFacts) {
  if (pendingVillageEmail) return VILLAGE_STATUSES.blocked;
  if (groupJoinedAt) return VILLAGE_STATUSES.ready;
  if (villageLinkedAt) return VILLAGE_STATUSES.syncing;
  return sharingConsentedAt ? VILLAGE_STATUSES.sharing : VILLAGE_STATUSES.notShared;
}
