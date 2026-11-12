import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { EyeOff } from "lucide-react";
import { notFound } from "next/navigation";
import { linkedinUrl } from "@villagehq/sdk";

import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readBrandingForPage } from "@/platform/branding/branding";
import { requireMember } from "@/platform/auth/session";
import { MAXIMUM_NAME_LENGTH } from "@/platform/auth/member-name";
import { hasPassword } from "@/platform/auth/password-setup";
import { isAdminMember } from "@/platform/auth/roles";
import { readResendConfig } from "@/platform/email/resend";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { modulePage } from "@/platform/modules/module-page";
import { FILL_IN_FIELDS, LOOKUP_STATUSES, type FillInField, type FilledLine } from "@/modules/members/contract-fill-in";
import { PROFILE_LIMITS } from "@/modules/members/contract-profile";
import { membersManifest } from "@/modules/members/manifest";
import { readFilledEmptyNote, toRoleLine } from "@/modules/members/rules-words";
import { memberNetwork } from "@/modules/members/schema";
import { readFilledLines, readLookupState } from "@/modules/members/service-fill-in";
import { readPrivacy } from "@/modules/members/service-privacy";
import { readMemberProfile } from "@/modules/members/service-profile";
import { FilledLinesSheet } from "@/modules/members/components/filled-lines-sheet";
import { LookupQuestionCard } from "@/modules/members/components/lookup-question-card";
import { OWN_FIELD_KEYS } from "@/modules/members/contract-own-words";
import { OwnWordsSheet, type OwnField } from "@/modules/members/components/own-words-sheet";
import { PasswordCard } from "@/modules/members/components/password-card";
import { PrivacySheet } from "@/modules/members/components/privacy-sheet";
import { ProfileHead } from "@/modules/members/components/profile-head";
import { introsManifest } from "@/modules/intros/manifest";
import { OurJobsSection } from "@/modules/job-board/components/our-jobs-section";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { isPublicBoardOn, readMemberSources, readSourceJobs } from "@/modules/job-board/reads";
import { LeaveGroupCard } from "@/modules/network/components/leave-group-card";
import { networkManifest } from "@/modules/network/manifest";
import { readIsInVillageGroup } from "@/modules/network/reads-progress";
import { MyNetworkSheet, type MyNetworkState } from "@/shell/my-network-sheet";

export const metadata: Metadata = { title: PAGE_TITLES.editCard };


type Profile = NonNullable<Awaited<ReturnType<typeof readMemberProfile>>>;

function readFilledValue(lines: readonly FilledLine[], field: FillInField) {
  return lines.find((line) => line.field === field && !line.isHidden)?.value ?? null;
}

function readOwnFields(profile: Profile, lines: readonly FilledLine[]): OwnField[] {
  return [
    { key: OWN_FIELD_KEYS.name, label: "Name", ownValue: profile.name, filledValue: null, maxLength: MAXIMUM_NAME_LENGTH },
    { key: OWN_FIELD_KEYS.role, label: "Role", ownValue: profile.title ?? "", filledValue: readFilledValue(lines, FILL_IN_FIELDS.title), maxLength: PROFILE_LIMITS.title },
    { key: OWN_FIELD_KEYS.company, label: "Company", ownValue: profile.company ?? "", filledValue: readFilledValue(lines, FILL_IN_FIELDS.company), maxLength: PROFILE_LIMITS.company },
    { key: OWN_FIELD_KEYS.city, label: "City", ownValue: profile.location ?? "", filledValue: readFilledValue(lines, FILL_IN_FIELDS.location), maxLength: PROFILE_LIMITS.location },
    { key: OWN_FIELD_KEYS.stage, label: "Stage", ownValue: profile.stage ?? "", filledValue: null, maxLength: PROFILE_LIMITS.stage },
    { key: OWN_FIELD_KEYS.sector, label: "Sector", ownValue: profile.sector ?? "", filledValue: null, maxLength: PROFILE_LIMITS.sector },
    { key: OWN_FIELD_KEYS.cohort, label: "Cohort or fund", ownValue: profile.cohort ?? "", filledValue: null, maxLength: PROFILE_LIMITS.cohort },
    { key: OWN_FIELD_KEYS.workingOn, label: "Working on now", ownValue: profile.bio ?? "", filledValue: null, isLong: true, isSerif: true, maxLength: PROFILE_LIMITS.bio },
    { key: OWN_FIELD_KEYS.canHelpWith, label: "Can help with", ownValue: profile.canHelpWith ?? "", filledValue: null, isLong: true, maxLength: PROFILE_LIMITS.canHelpWith },
    { key: OWN_FIELD_KEYS.lookingFor, label: "Looking for", ownValue: profile.needs ?? "", filledValue: null, isLong: true, maxLength: PROFILE_LIMITS.needs },
    // Community's own fields, kept: tags (found by the directory's search), LinkedIn and a website.
    {
      key: OWN_FIELD_KEYS.tags,
      label: "Tags",
      ownValue: profile.tags.join(", "),
      filledValue: null,
      maxLength: (PROFILE_LIMITS.tag + 2) * PROFILE_LIMITS.tags,
      hint: `Up to ${PROFILE_LIMITS.tags}, separated by commas.`,
    },
    { key: OWN_FIELD_KEYS.linkedin, label: "LinkedIn", ownValue: profile.linkedinSlug ? linkedinUrl(profile.linkedinSlug) : "", filledValue: null, maxLength: PROFILE_LIMITS.linkedinUrl },
    { key: OWN_FIELD_KEYS.website, label: "Website", ownValue: profile.website ?? "", filledValue: null, maxLength: PROFILE_LIMITS.website },
  ];
}

const OWN_OVER_FILLED: readonly { field: FillInField; own: (profile: Profile) => string | null }[] = [
  { field: FILL_IN_FIELDS.title, own: (profile) => profile.title },
  { field: FILL_IN_FIELDS.company, own: (profile) => profile.company },
  { field: FILL_IN_FIELDS.location, own: (profile) => profile.location },
];

async function readNetworkState(database: ReturnType<typeof getDatabase>, memberId: string, isNetworkOn: boolean): Promise<MyNetworkState> {
  if (!isNetworkOn) return { kind: "off" };
  const [row] = await database
    .select({ villageLinkedAt: memberNetwork.villageLinkedAt, groupJoinedAt: memberNetwork.groupJoinedAt, sharingConsentedAt: memberNetwork.sharingConsentedAt })
    .from(memberNetwork)
    .where(eq(memberNetwork.userId, memberId));
  if (!row?.villageLinkedAt) return { kind: "not_connected" };
  return { kind: "connected", connectedAt: row.villageLinkedAt.toISOString(), isSharing: row.groupJoinedAt !== null, hasAgreed: row.sharingConsentedAt !== null };
}

// Founderhall's My profile (member-me-profile): the head as members see it, the own words edited one field at a
// time, the lines filled in from public profiles, Privacy, My network and Our jobs.
export default modulePage(membersManifest, async function MyProfilePage() {
  const member = await requireMember();
  const database = getDatabase();
  const profile = await readMemberProfile(database, member.id);
  if (!profile) notFound();

  const [community, lookup, lines, privacy, isIntrosOn, isNetworkOn, isJobBoardOn, memberHasPassword] = await Promise.all([
    readBrandingForPage(),
    readLookupState(database, member.id),
    readFilledLines(database, member.id),
    readPrivacy(database, member.id),
    isModuleEnabled(database, introsManifest),
    isModuleEnabled(database, networkManifest),
    isModuleEnabled(database, jobBoardManifest),
    hasPassword(database, member.id),
  ]);
  const [networkState, showsLeaveCard, jobSources, isBoardPublic] = await Promise.all([
    readNetworkState(database, member.id, isNetworkOn),
    isNetworkOn ? false : readIsInVillageGroup(database, member.id),
    isJobBoardOn ? readMemberSources(database, member.id) : null,
    isJobBoardOn ? isPublicBoardOn(database) : false,
  ]);
  const jobsBySource = jobSources ? await readSourceJobs(database, jobSources.map(({ id }) => id)) : null;
  const isRefused = lookup.refusedAt !== null;
  const ownWordsFields = OWN_OVER_FILLED.filter(({ own }) => Boolean(own(profile))).map(({ field }) => field);

  return (
    <>
      <ProfileHead
        memberId={profile.id}
        name={profile.name}
        imageUrl={profile.shown.imageUrl}
        companyLogoUrl={profile.shown.companyLogoUrl}
        hasCompany={Boolean(profile.shown.company)}
        roleLine={toRoleLine(profile.shown)}
      >
        <p className="fh-small mt-1">This is how members see you. Change anything; you decide what shows.</p>
      </ProfileHead>
      {privacy.isHidden ? (
        <div className="fh-note mt-4">
          <EyeOff aria-hidden="true" className="fh-i fh-s" strokeWidth={1.5} />
          <span>You are hidden from the directory. Admins still see you in the member list.</span>
        </div>
      ) : null}

      <div className="fh-prof fh-section">
        <div>
          <OwnWordsSheet fields={readOwnFields(profile, lines)} isFillInOn={lookup.basis !== null} communityName={community.name} />
          {isNetworkOn && lookup.needsAnswer ? (
            <div className="mt-4">
              <LookupQuestionCard communityName={community.name} />
            </div>
          ) : null}
          <div className="mt-4">
            <FilledLinesSheet
              lines={isRefused ? [] : lines}
              refreshedAt={lookup.lookedUpAt?.toISOString() ?? null}
              isOwn
              isRefused={isRefused}
              ownWordsFields={ownWordsFields}
              emptyNote={readFilledEmptyNote({
                isFillInOn: lookup.basis !== null,
                isNotFound: lookup.status === LOOKUP_STATUSES.notFound,
                hasLines: lines.length > 0,
                communityName: community.name,
              })}
            />
          </div>
        </div>
        <div className="fh-stack">
          <PrivacySheet communityName={community.name} isHidden={privacy.isHidden} acceptsIntroAsks={isIntrosOn ? privacy.acceptsIntroAsks !== false : null} />
          <MyNetworkSheet state={networkState} communityName={community.name} />
          <PasswordCard hasPassword={memberHasPassword} isLinkOn={readResendConfig(process.env) !== null} />
          {showsLeaveCard ? <LeaveGroupCard /> : null}
        </div>
      </div>

      {jobSources && jobsBySource ? (
        <OurJobsSection
          sources={jobSources}
          jobsBySource={jobsBySource}
          company={profile.company ?? ""}
          isCompanyFixed={!isAdminMember(member)}
          communityName={community.name}
          isPublicBoardOn={isBoardPublic}
        />
      ) : null}
    </>
  );
});
