import "server-only";

import { and, count, countDistinct, eq, gte, isNotNull, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { comment, post, reaction } from "../feed/schema.ts";
import { introRequest } from "../intros/schema.ts";
import { directMessage } from "../messages/schema.ts";
import { memberNetwork } from "../members/schema.ts";
import { readIntroStateCounts } from "../intros/reads.ts";
import { readInviteCounts } from "../members/service-invites.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { readActiveMemberCount } from "../members/reads-directory.ts";
import { readSharingMemberCount } from "../network/reads-progress.ts";

const MILLISECONDS_PER_DAY = 86_400_000;
const WHOLE_PERCENT = 100;

export const HEALTH_WINDOWS_IN_DAYS = [7, 30] as const;

async function readConsentedMemberCount(database: Database) {
  const [row] = await database
    .select({ memberCount: count() })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(and(isNotNull(memberNetwork.sharingConsentedAt), isActiveMember()));
  return row?.memberCount ?? 0;
}

async function readPostCountSince(database: Database, since: Date) {
  const [row] = await database.select({ postCount: count() }).from(post).where(gte(post.createdAt, since));
  return row?.postCount ?? 0;
}

async function readActiveMemberCountSince(database: Database, since: Date) {
  const activity = unionAll(
    database.select({ memberId: sql<string>`${post.authorId}`.as("member_id") }).from(post).where(gte(post.createdAt, since)),
    database.select({ memberId: sql<string>`${comment.authorId}`.as("member_id") }).from(comment).where(gte(comment.createdAt, since)),
    database.select({ memberId: sql<string>`${reaction.userId}`.as("member_id") }).from(reaction).where(gte(reaction.createdAt, since)),
    database.select({ memberId: sql<string>`${directMessage.senderId}`.as("member_id") }).from(directMessage).where(gte(directMessage.createdAt, since)),
    database.select({ memberId: sql<string>`${introRequest.requesterId}`.as("member_id") }).from(introRequest).where(gte(introRequest.createdAt, since)),
  ).as("activity");
  const [row] = await database
    .select({ memberCount: countDistinct(activity.memberId) })
    .from(activity)
    .innerJoin(user, eq(user.id, activity.memberId))
    .where(isActiveMember());
  return row?.memberCount ?? 0;
}

async function readWindow(database: Database, days: number, now: Date) {
  const since = new Date(now.getTime() - days * MILLISECONDS_PER_DAY);
  const [posts, activeMembers] = await Promise.all([readPostCountSince(database, since), readActiveMemberCountSince(database, since)]);
  return { days, posts, activeMembers };
}

function readInviteAcceptance({ accepted, pending, expired, revoked }: Awaited<ReturnType<typeof readInviteCounts>>) {
  const sent = accepted + pending + expired;
  return { accepted, pending, expired, revoked, sent, acceptedPercent: sent === 0 ? null : Math.round((accepted / sent) * WHOLE_PERCENT) };
}

export async function readCommunityHealth(database: Database, now = new Date()) {
  const [members, sharing, synced, windows, intros, invites] = await Promise.all([
    readActiveMemberCount(database),
    readConsentedMemberCount(database),
    readSharingMemberCount(database),
    Promise.all(HEALTH_WINDOWS_IN_DAYS.map((days) => readWindow(database, days, now))),
    readIntroStateCounts(database),
    readInviteCounts(database, now),
  ]);
  return { members, sharing, synced, windows, intros, invites: readInviteAcceptance(invites) };
}
