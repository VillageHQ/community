import { INTRO_LIMITS } from "../intros/intro-api.ts";
import type { VillagePaths } from "../../platform/village/client.ts";
import {
  cleanVillageText,
  readScoreMetaReason,
  readSummaryReason,
  readThroughReason,
  readUnexplainedReason,
} from "./connector-reason.ts";
import { readLinkedinSlug } from "./linkedin-slug.ts";
import { namesMatch } from "./name-match.ts";
import type { Connector, NetworkPath, NetworkPaths } from "./network-api.ts";

export const COMMUNITY_MEMBER_LABEL = "Community member";

const DIRECT_DEGREE = 1;
const DIRECT_CONNECTION_PATTERN = /(\p{Extended_Pictographic}\s*)?Direct connection/gu;

type VillagePath = VillagePaths["paths"][number];
type PathProfile = VillagePath["starters"][number]["profile"];

export type ReachableMember = {
  id: string;
  name: string;
  headline: string | null;
  avatarUrl: string | null;
  isLinkedinConfirmed: boolean;
};
export type ReachableMembers = ReadonlyMap<string, ReachableMember>;
export type ConnectorDraft = Omit<Connector, "openAsk">;

export type MemberPathsFacts = {
  targetSlug: string;
  viewerSlug: string | null;
  memberSlugs: ReadonlySet<string>;
  reachableMembers: ReachableMembers;
  isCached: boolean;
  dailyLookupsLeft: number;
};

function relabelForMemberTarget(description: string | null | undefined, isTargetMember: boolean) {
  if (!description) return null;
  if (!isTargetMember) return description;
  return description.replace(DIRECT_CONNECTION_PATTERN, COMMUNITY_MEMBER_LABEL);
}

function readProfileName({ first_name, last_name }: Pick<PathProfile, "first_name" | "last_name">) {
  return [first_name, last_name].filter(Boolean).join(" ");
}

export function readTrustedMember(villageName: string | null, linkedinSlug: string | null, reachableMembers: ReachableMembers) {
  const member = linkedinSlug ? reachableMembers.get(linkedinSlug) : undefined;
  if (!member) return null;
  if (member.isLinkedinConfirmed) return member;
  return villageName !== null && namesMatch(villageName, member.name) ? member : null;
}

function readProfileMember(profile: PathProfile, reachableMembers: ReachableMembers) {
  return readTrustedMember(readProfileName(profile), readLinkedinSlug(profile.linkedin_url), reachableMembers);
}

function describePerson(profile: PathProfile, reachableMembers: ReachableMembers) {
  return {
    name: readProfileName(profile),
    linkedinSlug: readLinkedinSlug(profile.linkedin_url),
    isMember: readProfileMember(profile, reachableMembers) !== null,
  };
}

function compareMembersFirst(first: NetworkPath, second: NetworkPath) {
  return Number(second.involvesMember) - Number(first.involvesMember);
}

export function readTargetName(villagePaths: VillagePaths | null) {
  const person = villagePaths?.person;
  if (!person) return null;
  const name = person.full_name || readProfileName(person);
  return cleanVillageText(name, INTRO_LIMITS.nameLength) || null;
}

export function readPathSlugs(villagePaths: VillagePaths | null) {
  const profiles = (villagePaths?.paths ?? []).flatMap(({ introducer, starters }) => [
    ...(introducer ? [introducer.profile] : []),
    ...starters.map(({ profile }) => profile),
  ]);
  return profiles.flatMap(({ linkedin_url }) => {
    const slug = readLinkedinSlug(linkedin_url);
    return slug ? [slug] : [];
  });
}

type ConnectorFacts = {
  profile: PathProfile;
  reason: string;
  throughName: string | null;
  reachableMembers: ReachableMembers;
};

function toConnector({ profile, reason, throughName, reachableMembers }: ConnectorFacts): ConnectorDraft | null {
  const member = readProfileMember(profile, reachableMembers);
  const name = cleanVillageText(member?.name ?? readProfileName(profile), INTRO_LIMITS.nameLength);
  if (!name) return null;
  return {
    name,
    headline: member?.headline || cleanVillageText(profile.headline ?? "", INTRO_LIMITS.headlineLength) || null,
    linkedinSlug: readLinkedinSlug(profile.linkedin_url),
    reason,
    throughName,
    member: member ? { id: member.id, avatarUrl: member.avatarUrl } : null,
  };
}

function readIntroducerReason(path: VillagePath, name: string, targetName: string | null) {
  return (
    readScoreMetaReason(path.introducer?.score_meta, INTRO_LIMITS.reasonLength) ||
    readSummaryReason(path.summary.description, INTRO_LIMITS.reasonLength) ||
    readUnexplainedReason(name, targetName)
  );
}

function readStarterReason(starter: VillagePath["starters"][number], throughName: string, targetName: string | null) {
  const through = readThroughReason(readProfileName(starter.profile), throughName, targetName);
  const relationship = readScoreMetaReason(starter.score_meta, INTRO_LIMITS.reasonLength);
  return [through, relationship].filter(Boolean).join(" ").slice(0, INTRO_LIMITS.reasonLength);
}

function readPathConnector(
  path: VillagePath,
  { targetSlug, viewerSlug, reachableMembers }: MemberPathsFacts,
  targetName: string | null,
): ConnectorDraft | null {
  if (path.degree === DIRECT_DEGREE) return null;

  const introducerProfile = path.introducer?.profile;
  const introducerName = introducerProfile ? readProfileName(introducerProfile) : "";
  const introducerSlug = readLinkedinSlug(introducerProfile?.linkedin_url);
  const isIntroducerSomeoneElse = introducerSlug !== targetSlug && introducerSlug !== viewerSlug;
  const asksThroughIntroducer = introducerProfile && isIntroducerSomeoneElse;

  if (asksThroughIntroducer && readProfileMember(introducerProfile, reachableMembers)) {
    const reason = readIntroducerReason(path, introducerName, targetName);
    return toConnector({ profile: introducerProfile, reason, throughName: null, reachableMembers });
  }

  const starters = path.starters.filter(({ is_current_user, profile }) => {
    const slug = readLinkedinSlug(profile.linkedin_url);
    return !is_current_user && slug !== viewerSlug && slug !== targetSlug;
  });
  const memberStarter = starters.find(({ profile }) => readProfileMember(profile, reachableMembers));
  const starter = memberStarter ?? starters[0];

  if (starter && asksThroughIntroducer) {
    const throughName = introducerName;
    const reason = readStarterReason(starter, throughName, targetName);
    return toConnector({ profile: starter.profile, reason, throughName, reachableMembers });
  }
  if (!asksThroughIntroducer) return null;

  const reason = readIntroducerReason(path, introducerName, targetName);
  return toConnector({ profile: introducerProfile, reason, throughName: null, reachableMembers });
}

function readConnectorKey({ linkedinSlug, name }: ConnectorDraft) {
  return linkedinSlug ?? name;
}

export function readConnectors(villagePaths: VillagePaths | null, facts: MemberPathsFacts) {
  if (facts.targetSlug === facts.viewerSlug) return [];
  const targetName = readTargetName(villagePaths);
  const connectors = (villagePaths?.paths ?? []).flatMap((path) => {
    const connector = readPathConnector(path, facts, targetName);
    return connector ? [connector] : [];
  });
  const membersFirst = connectors.toSorted((first, second) => Number(second.member !== null) - Number(first.member !== null));
  const uniqueByPerson = new Map(membersFirst.toReversed().map((connector) => [readConnectorKey(connector), connector]));
  return [...uniqueByPerson.values()].toReversed();
}

export function describeMemberPaths(
  villagePaths: VillagePaths | null,
  facts: MemberPathsFacts,
  connectors: Connector[],
): NetworkPaths {
  const { targetSlug, viewerSlug, memberSlugs, reachableMembers, isCached, dailyLookupsLeft } = facts;
  const isTargetMember = memberSlugs.has(targetSlug);

  const paths = (villagePaths?.paths ?? []).map((path): NetworkPath => {
    const introducer = path.introducer ? describePerson(path.introducer.profile, reachableMembers) : null;
    const starters = path.starters.map((starter) => ({
      ...describePerson(starter.profile, reachableMembers),
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
    targetName: readTargetName(villagePaths),
    targetMemberId: readTrustedMember(readTargetName(villagePaths), targetSlug, reachableMembers)?.id ?? null,
    isViewer: targetSlug === viewerSlug,
    isDirectConnection: !isTargetMember && paths.some(({ degree }) => degree === DIRECT_DEGREE),
    dailyLookupsLeft,
    connectors,
    paths: paths.toSorted(compareMembersFirst),
  };
}
