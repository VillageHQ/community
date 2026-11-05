import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, Globe, Link2, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { getDatabase } from "@/database/client";
import { PAGE_TITLES } from "@/lib/branding/page-metadata";
import { readFirstName } from "@/lib/design/avatar-identity";
import { formatMonthAndYear } from "@/lib/format-date";
import { readExternalHost } from "@/lib/members/external-url";
import { isCardFilledIn, readMemberProfile } from "@/lib/members/profile";
import { ROUTES } from "@/lib/routes";
import { requireMember } from "@/lib/session";
import { toLinkedinUrl } from "@/lib/village/linkedin-slug";
import { isAdminMember } from "@/lib/village/member-network";

import { AdminMemberPanel } from "./admin-member-panel";

export const metadata: Metadata = { title: PAGE_TITLES.profile };

const PROFILE_AVATAR_SIZE_PX = 112;
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

export default async function MemberProfilePage({ params }: { params: Promise<{ memberId: string }> }) {
  const viewer = await requireMember();
  const { memberId } = await params;
  const profile = await readMemberProfile(getDatabase(), memberId);
  if (!profile) notFound();

  const isOwnProfile = viewer.id === profile.id;
  const roleLine = [profile.title, profile.company].filter(Boolean).join(", ");

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
          <Avatar stableId={profile.id} name={profile.name} imageUrl={profile.avatarUrl} sizePx={PROFILE_AVATAR_SIZE_PX} />
          <div className="min-w-0 flex-[1_1_240px]">
            <h1 className="type-h1">{profile.name}</h1>
            {roleLine ? <p className="type-lead mt-1 text-foreground-soft">{roleLine}</p> : null}
            {profile.location ? (
              <p className="type-small mt-1 flex items-center gap-1.5 text-foreground-soft">
                <MapPin aria-hidden="true" className="size-icon-small shrink-0" />
                {profile.location}
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
          ) : null}
        </div>
        {profile.linkedinSlug || profile.website ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {profile.linkedinSlug ? (
              <ExternalButton href={toLinkedinUrl(profile.linkedinSlug)} icon={<Link2 aria-hidden="true" />}>
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

      {isCardFilledIn(profile) ? null : (
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

      {isAdminMember(viewer) ? (
        <AdminMemberPanel
          memberId={profile.id}
          email={profile.email}
          isEmailConfirmed={profile.emailVerified}
          linkedinUrl={profile.linkedinSlug ? toLinkedinUrl(profile.linkedinSlug) : null}
        />
      ) : null}
    </div>
  );
}
