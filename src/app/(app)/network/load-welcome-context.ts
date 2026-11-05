import "server-only";

import type { Database } from "@/database/client";
import { readBrandingForPage } from "@/lib/branding/branding";
import { readResendConfig } from "@/lib/email/resend";
import { readAvatarUrl } from "@/lib/members/profile";
import { ROUTES } from "@/lib/routes";
import { isAdminMember, readIsLinkedinConfirmed, type SessionMember } from "@/lib/village/member-network";
import { hasFirstAndLastName } from "@/lib/village/name-match";
import { readSharingMemberCount, readWelcomeNeighbours } from "@/lib/village/network-progress";

import type { WelcomeContext } from "./welcome-context";

export async function loadWelcomeContext(
  database: Database,
  member: SessionMember & { name: string },
): Promise<WelcomeContext> {
  const [{ name, descriptor, logo }, neighbours, sharingMemberCount, avatarUrl, isLinkedinConfirmed] = await Promise.all([
    readBrandingForPage(),
    readWelcomeNeighbours(database, member.id),
    readSharingMemberCount(database),
    readAvatarUrl(database, member.id),
    readIsLinkedinConfirmed(database, member.id),
  ]);
  return {
    community: { name, descriptor, logo },
    member: { id: member.id, name: member.name, imageUrl: avatarUrl },
    neighbours,
    sharingMemberCount,
    notNowHref: isAdminMember(member) ? ROUTES.admin : ROUTES.feed,
    needsFullName: !isLinkedinConfirmed && !hasFirstAndLastName(member.name),
    memberEmail: member.email,
    isEmailConfigured: readResendConfig(process.env) !== null,
  };
}
