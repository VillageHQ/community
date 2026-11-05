import "server-only";

import { and, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberAvatar, memberProfile } from "../../database/members-schema.ts";
import { memberNetwork } from "../../database/village-schema.ts";
import { isActiveMember } from "../members/active-member.ts";
import { toAvatarUrl } from "../members/profile.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import type { ReachableMember } from "./member-paths.ts";

function isVerifiedMember() {
  return or(eq(user.emailVerified, true), eq(memberNetwork.approvedMemberEmail, sql`lower(${user.email})`));
}

export async function readReachableMembers(database: Database, linkedinSlugs: readonly string[], viewerId: string) {
  if (linkedinSlugs.length === 0) return new Map<string, ReachableMember>();

  const members = await database
    .select({
      id: user.id,
      name: user.name,
      title: memberProfile.title,
      company: memberProfile.company,
      linkedinSlug: memberNetwork.linkedinSlug,
      linkedinConfirmedSlug: memberNetwork.linkedinConfirmedSlug,
      avatarUpdatedAt: memberAvatar.updatedAt,
    })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .where(
      and(
        inArray(memberNetwork.linkedinSlug, [...linkedinSlugs]),
        isNotNull(memberNetwork.groupJoinedAt),
        ne(user.id, viewerId),
        isActiveMember(),
        isVerifiedMember(),
      ),
    );

  const reachableMembers = new Map<string, ReachableMember>();
  for (const { linkedinSlug, linkedinConfirmedSlug, id, name, title, company, avatarUpdatedAt } of members) {
    if (!linkedinSlug) continue;
    const headline = [title, company].filter(Boolean).join(", ") || null;
    reachableMembers.set(linkedinSlug, {
      id,
      name: removeBidiControls(name),
      headline: headline && removeBidiControls(headline),
      avatarUrl: toAvatarUrl(id, avatarUpdatedAt),
      isLinkedinConfirmed: linkedinConfirmedSlug === linkedinSlug,
    });
  }
  return reachableMembers;
}
