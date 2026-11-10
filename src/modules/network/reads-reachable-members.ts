import "server-only";

import { and, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { memberAvatar, memberProfile, memberNetwork } from "../members/schema.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { filledFaceColumn, shownCompanyColumn, toShownFaceUrl } from "../members/reads-pictures.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import type { ReachableMember } from "./rules-paths.ts";

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
      company: shownCompanyColumn(user.id),
      linkedinSlug: memberNetwork.linkedinSlug,
      linkedinConfirmedSlug: memberNetwork.linkedinConfirmedSlug,
      avatarUpdatedAt: memberAvatar.updatedAt,
      filledFace: filledFaceColumn(user.id),
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
  for (const { linkedinSlug, linkedinConfirmedSlug, id, name, title, company, avatarUpdatedAt, filledFace } of members) {
    if (!linkedinSlug) continue;
    const headline = [title, company].filter(Boolean).join(", ") || null;
    reachableMembers.set(linkedinSlug, {
      id,
      name: removeBidiControls(name),
      headline: headline && removeBidiControls(headline),
      avatarUrl: toShownFaceUrl(id, avatarUpdatedAt, filledFace),
      isLinkedinConfirmed: linkedinConfirmedSlug === linkedinSlug,
    });
  }
  return reachableMembers;
}
