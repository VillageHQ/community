export const VILLAGE_LINK_STATES = {
  needsReview: "needs_review",
  approved: "approved",
  joined: "joined",
  notJoined: "not_joined",
} as const;

type VillageLinkState = (typeof VILLAGE_LINK_STATES)[keyof typeof VILLAGE_LINK_STATES];

export const VILLAGE_LINK_TAGS: Record<VillageLinkState, { label: string; tone: "gold" | "sage" | "neutral" }> = {
  [VILLAGE_LINK_STATES.needsReview]: { label: "Needs your review", tone: "gold" },
  [VILLAGE_LINK_STATES.approved]: { label: "Approved by an admin", tone: "sage" },
  [VILLAGE_LINK_STATES.joined]: { label: "In the group", tone: "sage" },
  [VILLAGE_LINK_STATES.notJoined]: { label: "Not joined yet", tone: "neutral" },
};

type VillageLinkFacts = {
  villageEmail: string | null;
  approvedVillageEmail: string | null;
  groupJoinedAt: Date | string | null;
};

export function readVillageLinkState({ villageEmail, approvedVillageEmail, groupJoinedAt }: VillageLinkFacts) {
  if (villageEmail) return VILLAGE_LINK_STATES.needsReview;
  if (approvedVillageEmail) return VILLAGE_LINK_STATES.approved;
  return groupJoinedAt ? VILLAGE_LINK_STATES.joined : VILLAGE_LINK_STATES.notJoined;
}
