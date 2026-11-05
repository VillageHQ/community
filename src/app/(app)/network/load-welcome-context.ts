import "server-only";

import type { Database } from "@/database/client";
import { readBrandingForPage } from "@/lib/branding/branding";
import { readResendConfig } from "@/lib/email/resend";
import { ROUTES } from "@/lib/routes";
import { isAdminMember, type SessionMember } from "@/lib/village/member-network";
import { readSharingMemberCount, readWelcomeNeighbours } from "@/lib/village/network-progress";

import type { WelcomeContext } from "./welcome-context";

export async function loadWelcomeContext(
  database: Database,
  member: SessionMember & { name: string },
): Promise<WelcomeContext> {
  const [{ name, descriptor, logo }, neighbours, sharingMemberCount] = await Promise.all([
    readBrandingForPage(),
    readWelcomeNeighbours(database, member.id),
    readSharingMemberCount(database),
  ]);
  return {
    community: { name, descriptor, logo },
    member: { id: member.id, name: member.name },
    neighbours,
    sharingMemberCount,
    notNowHref: isAdminMember(member) ? ROUTES.admin : ROUTES.feed,
    memberEmail: member.email,
    isEmailConfigured: readResendConfig(process.env) !== null,
  };
}
