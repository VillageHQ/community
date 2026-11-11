import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, Globe, Link2, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CompanyLogo } from "@/components/company-name";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getDatabase } from "@/platform/database/client";
import { PAGE_TITLES } from "@/platform/branding/page-metadata";
import { readFirstName } from "@/platform/design/avatar-identity";
import { formatLongDate, formatMonthAndYear } from "@/platform/text/format-date";
import { FILL_IN_SOURCE_LABEL } from "@/modules/members/contract-fill-in";
import { readExternalHost } from "@/modules/members/rules-external-url";
import { isBlockedBy } from "@/modules/members/service-blocks";
import { isCardFilledIn, readMemberProfile } from "@/modules/members/service-profile";
import { isHiddenMember } from "@/modules/members/service-privacy";
import { ROUTES } from "@/platform/http/routes";
import { requireMember } from "@/platform/auth/session";
import { linkedinUrl } from "@villagehq/sdk";
import { isAdminMember } from "@/platform/auth/roles";

import { BlockMemberButton } from "@/modules/members/components/block-member-button";
import { MemberConversationSlot } from "@/modules/members/slots";
import { INBOX_QUERY_FILTER } from "@/modules/messages/queries";
import { AdminMemberPanel } from "@/modules/members/components/admin-member-panel";
import { membersManifest } from "@/modules/members/manifest";
import { modulePage } from "@/platform/modules/module-page";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { CompanyJobsCard } from "@/modules/job-board/components/shared/company-jobs-card";
import { jobBoardManifest } from "@/modules/job-board/manifest";
import { readCompanyJobs } from "@/modules/job-board/reads-hiring";

export const metadata: Metadata = { title: PAGE_TITLES.profile };

const PROFILE_AVATAR_SIZE_PX = 112;
const PROFILE_LOGO_SIZE_PX = 20;
const EXTERNAL_LINK_RELATIONSHIP = "noopener noreferrer nofollow";

function ExternalButton({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel={EXTERNAL_LINK_RELATIONSHIP}>
        {icon}
        {children}
        <ExternalLink aria-hidden="true" className="size-3.5" />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Button>
  );
}

function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="type-lead mt-2 whitespace-pre-line text-foreground-soft">{children}</p>
    </Card>
  );
}

export default modulePage(membersManifest, async function MemberProfilePage({ params }: { params: Promise<{ memberId: string }> }) {
  const viewer = await requireMember();
  const { memberId } = await params;
  const database = getDatabase();
  const profile = await readMemberProfile(database, memberId);
  if (!profile) notFound();

  const isOwnProfile = viewer.id === profile.id;
  // "Hide me from the directory": members can't open the profile either. Admins still can.
  if (!isOwnProfile && !isAdminMember(viewer) && (await isHiddenMember(database, profile.id))) notFound();
  const isBlockedByViewer = !isOwnProfile && (await isBlockedBy(database, viewer.id, profile.id));
  const { shown } = profile;
  const roleLine = shown.title ? `${shown.title}${shown.company ? ", " : ""}` : "";
  const facts = [profile.stage, profile.sector, profile.cohort].filter(Boolean).join(" · ");
  const companyJobs = shown.company && (await isModuleEnabled(database, jobBoardManifest)) ? await readCompanyJobs(database, shown.company) : null;

  return (
    <div className="mx-auto grid max-w-[820px] gap-5">
      <div>
        <Button asChild variant="quiet" size="sm">
          <Link href={ROUTES.members}>
            <ArrowLeft aria-hidden="true" />
            All members
          </Link>
        </Button>
      </div>
      <header className="rounded-card bg-accent p-card-phone sm:rounded-panel sm:p-8">
        <div className="flex flex-wrap items-center gap-5">
          <Avatar stableId={profile.id} name={profile.name} imageUrl={shown.imageUrl} sizePx={PROFILE_AVATAR_SIZE_PX} />
          <div className="min-w-0 flex-[1_1_240px]">
            <h1 className="type-h1">{profile.name}</h1>
            {roleLine || shown.company ? (
              <p className="type-lead mt-1 wrap-anywhere text-foreground-soft">
                {roleLine}
                {shown.company ? (
                  <>
                    <CompanyLogo url={shown.companyLogoUrl} sizePx={PROFILE_LOGO_SIZE_PX} className="mt-0 mr-1.5 align-[-0.2em]" />
                    {shown.company}
                  </>
                ) : null}
              </p>
            ) : null}
            {shown.location ? (
              <p className="type-small mt-1 flex items-center gap-1.5 text-foreground-soft">
                <MapPin aria-hidden="true" className="size-icon-small shrink-0" />
                {shown.location}
              </p>
            ) : null}
            {facts ? <p className="type-small mt-1 text-foreground-soft">{facts}</p> : null}
            {shown.headline ? <p className="type-small mt-1 text-foreground-soft">{shown.headline}</p> : null}
            {shown.filledAt ? (
              <p className="type-small mt-2 text-muted-foreground">
                {FILL_IN_SOURCE_LABEL}, {formatLongDate(shown.filledAt)}
                {isOwnProfile ? (
                  <>
                    {" · "}
                    <Link href={ROUTES.editCard} className="underline underline-offset-3">
                      Hide a line
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          {isOwnProfile ? (
            <Button asChild className="max-sm:w-full">
              <Link href={ROUTES.editCard}>
                <Pencil aria-hidden="true" />
                Edit my card
              </Link>
            </Button>
          ) : (
            <MemberConversationSlot
              memberId={profile.id}
              label="Message"
              accessibleName={`Message ${profile.name}`}
              size="lg"
              className="max-sm:w-full"
            />
          )}
        </div>
        {profile.linkedinSlug || profile.website ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.linkedinSlug ? (
              <ExternalButton href={linkedinUrl(profile.linkedinSlug)} icon={<Link2 aria-hidden="true" />}>
                LinkedIn
              </ExternalButton>
            ) : null}
            {profile.website ? (
              <ExternalButton href={profile.website} icon={<Globe aria-hidden="true" />}>
                {readExternalHost(profile.website)}
              </ExternalButton>
            ) : null}
          </div>
        ) : null}
      </header>

      {profile.bio ? <ProfileSection title={`About ${readFirstName(profile.name)}`}>{profile.bio}</ProfileSection> : null}
      {profile.canHelpWith ? <ProfileSection title="Ask me about">{profile.canHelpWith}</ProfileSection> : null}
      {profile.needs ? <ProfileSection title="What I need right now">{profile.needs}</ProfileSection> : null}

      {companyJobs && shown.company ? <CompanyJobsCard company={shown.company} companyJobs={companyJobs} /> : null}

      {profile.tags.length > 0 ? (
        <Card>
          <CardTitle>Tags</CardTitle>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {profile.tags.map((tag) => (
              <li key={tag}>
                <Tag>{tag}</Tag>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {isCardFilledIn({ ...profile, title: shown.title, company: shown.company }) ? null : (
        <Card>
          <CardTitle>{isOwnProfile ? "Your card is still empty" : `${readFirstName(profile.name)} is still settling in`}</CardTitle>
          <p className="type-lead mt-2 text-foreground-soft">
            {isOwnProfile
              ? "Add a line about you and what you can help with, so members know how to find you."
              : "They haven't filled in their card yet. Check back soon."}
          </p>
        </Card>
      )}

      <p className="type-small px-1 text-muted-foreground">Joined {formatMonthAndYear(profile.createdAt)}.</p>

      {isOwnProfile ? null : <BlockMemberButton memberId={profile.id} memberName={profile.name} isBlocked={isBlockedByViewer} refreshesAfterChange={INBOX_QUERY_FILTER} />}

      {isAdminMember(viewer) ? (
        <AdminMemberPanel email={profile.email} isEmailConfirmed={profile.emailVerified} isLinkedinConfirmed={profile.isLinkedinConfirmed} />
      ) : null}
    </div>
  );
});
