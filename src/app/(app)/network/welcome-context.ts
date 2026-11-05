import type { ConstellationPerson } from "@/components/constellation";
import type { CommunityLogo } from "@/lib/branding/branding";

const MINIMUM_MEMBERS_TO_COUNT = 2;

export type WelcomeContext = {
  community: { name: string; descriptor: string; logo: CommunityLogo | null };
  member: ConstellationPerson;
  neighbours: ConstellationPerson[];
  sharingMemberCount: number;
  notNowHref: string;
  memberEmail?: string;
  isEmailConfigured?: boolean;
  isOnboarding?: boolean;
  inviter?: { id: string | null; name: string; title: string | null } | null;
};

export function readSharingSentence({ community, sharingMemberCount }: WelcomeContext) {
  if (sharingMemberCount < MINIMUM_MEMBERS_TO_COUNT) {
    return `${community.name} members help each other meet the right people.`;
  }
  return `${sharingMemberCount} members are already here, helping each other meet the right people.`;
}
