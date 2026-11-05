import "server-only";

import type { Database } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { readResendConfig } from "@/platform/email/resend";
import { readAvatarUrl } from "@/lib/members/profile";
import { ROUTES } from "@/platform/http/routes";
import { isAdminMember } from "@/platform/auth/roles";
import { readIsLinkedinConfirmed } from "@/lib/members/linkedin-claim";
import { type SessionMember } from "@/platform/http/request-context";
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
