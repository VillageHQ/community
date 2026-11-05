import "server-only";

import { networkManifest } from "@/modules/network/manifest";
import { isModuleEnabled } from "@/platform/modules/enablement";
import type { Database } from "@/platform/database/client";
import { readBrandingForPage } from "@/platform/branding/branding";
import { readResendConfig } from "@/platform/email/resend";
import { readAvatarUrl } from "@/modules/members/service-profile";
import { ROUTES } from "@/platform/http/routes";
import { isAdminMember } from "@/platform/auth/roles";
import { readIsLinkedinConfirmed } from "@/modules/members/service-linkedin";
import { type SessionMember } from "@/platform/http/request-context";
import { hasFirstAndLastName } from "@/modules/network/rules-name-match";
import { readSharingMemberCount, readWelcomeNeighbours } from "@/modules/network/reads-progress";

import type { WelcomeContext } from "@/modules/members/components/shared/welcome-context";

export async function loadWelcomeContext(
  database: Database,
  member: SessionMember & { name: string },
): Promise<WelcomeContext> {
  const isNetworkOn = await isModuleEnabled(database, networkManifest);
  const [{ name, descriptor, logo }, neighbours, sharingMemberCount, avatarUrl, isLinkedinConfirmed] = await Promise.all([
    readBrandingForPage(),
    isNetworkOn ? readWelcomeNeighbours(database, member.id) : [],
    isNetworkOn ? readSharingMemberCount(database) : 0,
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
    isNetworkOn,
  };
}
