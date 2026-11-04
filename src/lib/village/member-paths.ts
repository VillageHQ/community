import type { VillagePaths } from "./client.ts";
import { readLinkedinSlug } from "./linkedin-slug.ts";
import type { NetworkPath, NetworkPaths } from "./network-api.ts";

export const COMMUNITY_MEMBER_LABEL = "Community member";

const DIRECT_CONNECTION_PATTERN = /(\p{Extended_Pictographic}\s*)?Direct connection/gu;

type PathProfile = VillagePaths["paths"][number]["starters"][number]["profile"];

function relabelForMemberTarget(description: string | null | undefined, isTargetMember: boolean) {
  if (!description) return null;
  if (!isTargetMember) return description;
  return description.replace(DIRECT_CONNECTION_PATTERN, COMMUNITY_MEMBER_LABEL);
}

function describePerson(profile: PathProfile, memberSlugs: ReadonlySet<string>) {
  const linkedinSlug = readLinkedinSlug(profile.linkedin_url);
  return {
    name: [profile.first_name, profile.last_name].filter(Boolean).join(" "),
    linkedinSlug,
    isMember: linkedinSlug !== null && memberSlugs.has(linkedinSlug),
  };
}

function compareMembersFirst(first: NetworkPath, second: NetworkPath) {
  return Number(second.involvesMember) - Number(first.involvesMember);
}

export function describeMemberPaths(
  villagePaths: VillagePaths | null,
  targetSlug: string,
  memberSlugs: ReadonlySet<string>,
  isCached: boolean,
): NetworkPaths {
  const isTargetMember = memberSlugs.has(targetSlug);

  const paths = (villagePaths?.paths ?? []).map((path): NetworkPath => {
    const introducer = path.introducer ? describePerson(path.introducer.profile, memberSlugs) : null;
    const starters = path.starters.map((starter) => ({
      ...describePerson(starter.profile, memberSlugs),
      isCurrentUser: Boolean(starter.is_current_user),
    }));
    return {
      degree: path.degree,
      description: relabelForMemberTarget(path.summary.description, isTargetMember),
      scoreLabel: path.summary.score_label ?? null,
      involvesMember:
        isTargetMember ||
        Boolean(introducer?.isMember) ||
        starters.some((starter) => starter.isMember),
      introducer,
      starters,
    };
  });

  return {
    summary: relabelForMemberTarget(villagePaths?.summary?.description, isTargetMember),
    isTargetMember,
    isCached,
    paths: paths.toSorted(compareMembersFirst),
  };
}
