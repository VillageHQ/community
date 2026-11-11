import type { Metadata } from "next";
import { ArrowLeftRight, ExternalLink, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FieldBlock } from "@/components/ui/rows";
import { Tag, Tags } from "@/components/ui/tag";
import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { formatDayMonth } from "@/platform/text/format-date";
import { LOOKUP_STATUSES } from "@/modules/members/contract-fill-in";
import { readExternalHost } from "@/modules/members/rules-external-url";
import { readFilledEmptyNote, readFirstWord, toPossessive, toRoleLine } from "@/modules/members/rules-words";
import { isBlockedBy } from "@/modules/members/service-blocks";
import { readFilledLines, readLookupState } from "@/modules/members/service-fill-in";
import { readMemberProfile } from "@/modules/members/service-profile";
import { isHiddenMember, readAcceptsIntroAsks } from "@/modules/members/service-privacy";
import { introsManifest } from "@/modules/intros/manifest";
import { networkManifest } from "@/modules/network/manifest";
import { readMemberReach } from "@/modules/network/reads-member-reach";
import { readBrandingForPage } from "@/platform/branding/branding";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { linkedinUrl } from "@villagehq/sdk";
import { isAdminMember } from "@/platform/auth/roles";

import { BlockMemberButton } from "@/modules/members/components/block-member-button";
import { FilledLinesSheet } from "@/modules/members/components/filled-lines-sheet";
import { ProfileHead } from "@/modules/members/components/profile-head";
import { MemberConversationSlot } from "@/modules/members/slots";
import { INBOX_QUERY_FILTER } from "@/modules/messages/queries";
import { AdminMemberPanel } from "@/modules/members/components/admin-member-panel";
import { membersManifest } from "@/modules/members/manifest";
import { modulePage } from "@/platform/modules/module-page";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { CompanyJobsCard } from "@/modules/job-board/components/shared/company-jobs-card";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { readCompanyJobs } from "@/modules/job-board/reads-hiring";

type ProfilePageProps = { params: Promise<{ memberId: string }> };

// The tab reads "Ada Okafor · Northwind Founders", as Founderhall's does.
export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { memberId } = await params;
  const profile = await readMemberProfile(getDatabase(), memberId);
  return { title: profile?.name ?? PAGE_TITLES.profile };
}

const EXTERNAL_LINK_RELATIONSHIP = "noopener noreferrer nofollow";

function ExternalLinkLine({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel={EXTERNAL_LINK_RELATIONSHIP} className="mr-4 inline-flex items-center gap-1">
      {label}
      <ExternalLink aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

// Founderhall's member profile (member-profile-other): the head on the page, the member's own words, the lines
// filled in from public profiles, and "Who <first name> can introduce you to" on the right.
export default modulePage(membersManifest, async function MemberProfilePage({ params }: ProfilePageProps) {
  const viewer = await requireMember();
  const { memberId } = await params;
  const database = getDatabase();
  const profile = await readMemberProfile(database, memberId);
  if (!profile) notFound();

  const isOwnProfile = viewer.id === profile.id;
  // "Hide me from the directory": members can't open the profile either. Admins still can.
  if (!isOwnProfile && !isAdminMember(viewer) && (await isHiddenMember(database, profile.id))) notFound();
  const isBlockedByViewer = !isOwnProfile && (await isBlockedBy(database, viewer.id, profile.id));
  const [isIntrosOn, isNetworkOn, isJobBoardOn, community, lookup, lines] = await Promise.all([
    isModuleEnabled(database, introsManifest),
    isModuleEnabled(database, networkManifest),
    isModuleEnabled(database, jobBoardManifest),
    readBrandingForPage(),
    readLookupState(database, profile.id),
    readFilledLines(database, profile.id),
  ]);
  // With search on, the admins' "chosen introducers" rule decides who can be asked, as it does on the server.
  const reach = isNetworkOn && !isOwnProfile ? await readMemberReach(database, profile.id) : null;
  const acceptsAsks = await readAcceptsIntroAsks(database, profile.id);
  const showsAsk = isIntrosOn && !isOwnProfile && !isBlockedByViewer && (reach?.isIntroducer ?? true);
  const first = readFirstWord(profile.name);
  const { shown } = profile;
  const chips = [profile.stage, profile.sector, profile.cohort].filter((chip): chip is string => Boolean(chip));
  const ownWords = [
    { key: "working_on", label: "Working on now", value: profile.bio, isSerif: true },
    { key: "can_help_with", label: "Can help with", value: profile.canHelpWith, isSerif: false },
    { key: "looking_for", label: "Looking for", value: profile.needs, isSerif: false },
  ].filter((field) => field.value);
  const isRefused = lookup.refusedAt !== null;
  const visibleLines = lines.filter((line) => !line.isHidden);
  const companyJobs = shown.company && isJobBoardOn ? await readCompanyJobs(database, shown.company) : null;

  return (
    <>
      <BackLink href={ROUTES.members}>Directory</BackLink>
      <ProfileHead
        memberId={profile.id}
        name={profile.name}
        imageUrl={shown.imageUrl}
        companyLogoUrl={shown.companyLogoUrl}
        hasCompany={Boolean(shown.company)}
        roleLine={toRoleLine(shown)}
      >
        {chips.length > 0 ? (
          <Tags className="mt-2">
            {chips.map((chip) => (
              <Tag key={chip}>{chip}</Tag>
            ))}
          </Tags>
        ) : null}
        {isOwnProfile ? (
          <div className="fh-btn-row mt-3.5">
            <Button asChild variant="primary" size="sm">
              <Link href={ROUTES.editCard}>
                <Pencil aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
                Edit my profile
              </Link>
            </Button>
          </div>
        ) : (
          <div className="fh-btn-row mt-3.5">
            {showsAsk ? (
              acceptsAsks ? (
                <Button asChild variant="primary" size="sm">
                  <Link href={`${ROUTES.intros}/new?via=${encodeURIComponent(profile.id)}`}>
                    <ArrowLeftRight aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
                    Ask for an intro via {first}
                  </Link>
                </Button>
              ) : (
                <span className="fh-btn fh-btn-secondary fh-btn-sm" aria-disabled="true">
                  {first} has paused intro asks
                </span>
              )
            ) : null}
            <MemberConversationSlot memberId={profile.id} label="Message" accessibleName={`Message ${profile.name}`} variant="secondary" size="sm" showsIcon />
          </div>
        )}
      </ProfileHead>

      <div className="fh-prof fh-section">
        <div>
          <section className="fh-sheet" aria-label={`In ${toPossessive(first)} own words`}>
            <div className="fh-source">
              <Pencil aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
              In {toPossessive(first)} own words · fresh as of {formatDayMonth(profile.freshAt)}
            </div>
            {ownWords.length > 0 || profile.tags.length > 0 || profile.linkedinSlug || profile.website ? (
              <>
                {ownWords.map((field) => (
                  <FieldBlock key={field.key} label={field.label} isSerif={field.isSerif}>
                    <p className="whitespace-pre-line">{field.value}</p>
                  </FieldBlock>
                ))}
                {profile.tags.length > 0 ? (
                  <FieldBlock label="Tags">
                    <Tags>
                      {profile.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Tags>
                  </FieldBlock>
                ) : null}
                {profile.linkedinSlug || profile.website ? (
                  <FieldBlock label="Links">
                    {profile.linkedinSlug ? <ExternalLinkLine href={linkedinUrl(profile.linkedinSlug)} label="LinkedIn" /> : null}
                    {profile.website ? <ExternalLinkLine href={profile.website} label={readExternalHost(profile.website)} /> : null}
                  </FieldBlock>
                ) : null}
              </>
            ) : (
              <p className="fh-muted mt-2">{first} hasn’t written anything yet.</p>
            )}
          </section>
          {isRefused && !isOwnProfile ? null : (
            <div className="mt-4">
              <FilledLinesSheet
                lines={visibleLines}
                refreshedAt={lookup.lookedUpAt?.toISOString() ?? null}
                isOwn={false}
                isRefused={isRefused}
                emptyNote={readFilledEmptyNote({
                  isFillInOn: lookup.basis !== null,
                  isNotFound: lookup.status === LOOKUP_STATUSES.notFound,
                  hasLines: visibleLines.length > 0,
                  communityName: community.name,
                })}
              />
            </div>
          )}
        </div>
        <div className="fh-stack">
          {reach ? (
            <section className="fh-sheet">
              <h2 className="fh-h3">Who {first} can introduce you to</h2>
              {reach.sharesNetwork ? (
                <>
                  <p className="fh-small mt-1.5">
                    {toPossessive(first)} network is shared with {community.name}. Search for the person you need: when {first} knows them, the path shows “via {profile.name}”.
                  </p>
                  <div className="fh-btn-row mt-3">
                    <Button asChild variant="primary" size="sm">
                      <Link href={ROUTES.network}>
                        <Search aria-hidden="true" className="fh-i fh-xs" strokeWidth={1.5} />
                        Search
                      </Link>
                    </Button>
                  </div>
                  <p className="fh-small fh-muted mt-2.5">You see that {first} knows a person, never the contact list. Nobody is introduced without saying yes.</p>
                </>
              ) : reach.isIntroducer ? (
                <p className="fh-small fh-muted mt-1.5">{first} hasn’t shared a network, so there are no paths through them yet. Nobody is introduced without saying yes.</p>
              ) : (
                <p className="fh-small fh-muted mt-1.5">In this community, intros go through members the admins chose, and {first} isn’t one of them.</p>
              )}
            </section>
          ) : null}
          {companyJobs && shown.company ? <CompanyJobsCard company={shown.company} companyJobs={companyJobs} /> : null}
        </div>
      </div>

      {isOwnProfile ? null : (
        <div className="fh-section">
          <BlockMemberButton memberId={profile.id} memberName={profile.name} isBlocked={isBlockedByViewer} refreshesAfterChange={INBOX_QUERY_FILTER} />
        </div>
      )}

      {isAdminMember(viewer) ? (
        <div className="fh-section">
          <AdminMemberPanel email={profile.email} isEmailConfirmed={profile.emailVerified} isLinkedinConfirmed={profile.isLinkedinConfirmed} />
        </div>
      ) : null}
    </>
  );
});
