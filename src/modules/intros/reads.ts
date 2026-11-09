import "server-only";

import { and, count, desc, eq, inArray, isNotNull, lte, notExists, notInArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { introRequest } from "./schema.ts";
import { memberAvatar, memberProfile, memberNetwork, memberBlock } from "../members/schema.ts";
import { isActiveMember, isBanActive } from "../../platform/auth/member-status.ts";
import { toAvatarUrl } from "../members/service-profile.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import {
  INTRO_LIFETIME_DAYS,
  INTRO_LIMITS,
  INTRO_ROLES,
  INTRO_STATES,
  OPEN_INTRO_STATES,
  introSchema,
  readStatesLeadingTo,
  type Intro,
  type IntroBoard,
  type IntroCounts,
} from "./contract.ts";

const MILLISECONDS_PER_DAY = 86_400_000;

const requesterUser = alias(user, "requester_user");
const requesterProfile = alias(memberProfile, "requester_profile");
const requesterNetwork = alias(memberNetwork, "requester_network");
const requesterAvatar = alias(memberAvatar, "requester_avatar");
const introducerUser = alias(user, "introducer_user");
const introducerAvatar = alias(memberAvatar, "introducer_avatar");

export function readIntroDeadline(from = new Date()) {
  return new Date(from.getTime() + INTRO_LIFETIME_DAYS * MILLISECONDS_PER_DAY);
}

function selectJoinedMemberIds(database: Database) {
  return database.select({ userId: memberNetwork.userId }).from(memberNetwork).where(isNotNull(memberNetwork.groupJoinedAt));
}

export function hasBothParticipantsJoined(database: Database) {
  return and(
    inArray(introRequest.requesterId, selectJoinedMemberIds(database)),
    inArray(introRequest.introducerId, selectJoinedMemberIds(database)),
  );
}

// With a member, expires only their asks, at read time. Without one (the timed sweep), every
// due ask, so admin counts are right even when nobody opens the page. Each write still checks state.
export async function expireDueIntros(database: Database, memberId: string | null) {
  const now = new Date();
  await database
    .update(introRequest)
    .set({ state: INTRO_STATES.expired, closedAt: now, requesterHasUpdate: true })
    .where(
      and(
        memberId === null ? undefined : or(eq(introRequest.requesterId, memberId), eq(introRequest.introducerId, memberId)),
        inArray(introRequest.state, readStatesLeadingTo(INTRO_STATES.expired)),
        or(
          lte(introRequest.expiresAt, now),
          notInArray(introRequest.requesterId, selectJoinedMemberIds(database)),
          notInArray(introRequest.introducerId, selectJoinedMemberIds(database)),
        ),
      ),
    );
}

function isDeliveredToIntroducer(database: Database, memberId: string) {
  const blocksFromIntroducer = database
    .select({ blockerId: memberBlock.blockerId })
    .from(memberBlock)
    .where(and(eq(memberBlock.blockerId, memberId), eq(memberBlock.blockedId, introRequest.requesterId)));
  return and(
    eq(introRequest.introducerId, memberId),
    eq(introRequest.isWithheld, false),
    isActiveMember(new Date(), requesterUser),
    notExists(blocksFromIntroducer),
  );
}

function isVisibleTo(database: Database, memberId: string) {
  return or(eq(introRequest.requesterId, memberId), isDeliveredToIntroducer(database, memberId));
}

function selectIntros(database: Database) {
  return database
    .select({
      request: introRequest,
      requesterName: requesterUser.name,
      requesterBanned: requesterUser.banned,
      requesterBanExpires: requesterUser.banExpires,
      requesterTitle: requesterProfile.title,
      requesterCompany: requesterProfile.company,
      requesterSlug: requesterNetwork.linkedinSlug,
      requesterAvatarUpdatedAt: requesterAvatar.updatedAt,
      introducerBanned: introducerUser.banned,
      introducerBanExpires: introducerUser.banExpires,
      introducerAvatarUpdatedAt: introducerAvatar.updatedAt,
    })
    .from(introRequest)
    .innerJoin(requesterUser, eq(requesterUser.id, introRequest.requesterId))
    .innerJoin(introducerUser, eq(introducerUser.id, introRequest.introducerId))
    .leftJoin(requesterProfile, eq(requesterProfile.userId, introRequest.requesterId))
    .leftJoin(requesterNetwork, eq(requesterNetwork.userId, introRequest.requesterId))
    .leftJoin(requesterAvatar, eq(requesterAvatar.userId, introRequest.requesterId))
    .leftJoin(introducerAvatar, eq(introducerAvatar.userId, introRequest.introducerId))
    .$dynamic();
}

type IntroRow = Awaited<ReturnType<ReturnType<typeof selectIntros>["execute"]>>[number];

function toIso(date: Date | null) {
  return date ? date.toISOString() : null;
}

function toIntro(row: IntroRow, viewerId: string): Intro {
  const { request } = row;
  const isRequester = request.requesterId === viewerId;
  return introSchema.parse({
    id: request.id,
    state: request.state,
    viewerRole: isRequester ? INTRO_ROLES.requester : INTRO_ROLES.introducer,
    note: request.note,
    reason: request.reason,
    declineReason: isRequester ? null : request.declineReason,
    hasUpdate: isRequester && request.requesterHasUpdate,
    createdAt: request.createdAt.toISOString(),
    acceptedAt: toIso(request.acceptedAt),
    closedAt: toIso(request.closedAt),
    expiresAt: request.expiresAt.toISOString(),
    target: { name: request.targetName, headline: request.targetHeadline, linkedinSlug: request.targetLinkedinSlug },
    requester: {
      id: request.requesterId,
      name: removeBidiControls(row.requesterName),
      headline: removeBidiControls([row.requesterTitle, row.requesterCompany].filter(Boolean).join(", ")) || null,
      linkedinSlug: row.requesterSlug,
      avatarUrl: toAvatarUrl(request.requesterId, row.requesterAvatarUpdatedAt),
      isAvailable: !isBanActive({ banned: row.requesterBanned, banExpires: row.requesterBanExpires }),
    },
    introducer: {
      id: request.introducerId,
      name: request.introducerName,
      headline: request.introducerHeadline,
      linkedinSlug: request.introducerLinkedinSlug,
      avatarUrl: toAvatarUrl(request.introducerId, row.introducerAvatarUpdatedAt),
      isAvailable: !isBanActive({ banned: row.introducerBanned, banExpires: row.introducerBanExpires }),
    },
  });
}

export async function readIntroForViewer(database: Database, viewerId: string, introId: string) {
  await expireDueIntros(database, viewerId);
  const [row] = await selectIntros(database).where(and(eq(introRequest.id, introId), isVisibleTo(database, viewerId)));
  return row ? toIntro(row, viewerId) : null;
}

async function countUpdates(database: Database, memberId: string) {
  const [updates] = await database
    .select({ value: count() })
    .from(introRequest)
    .where(and(eq(introRequest.requesterId, memberId), eq(introRequest.requesterHasUpdate, true)));
  return updates?.value ?? 0;
}

async function countWaitingOnYou(database: Database, memberId: string) {
  const [waiting] = await database
    .select({ value: count() })
    .from(introRequest)
    .innerJoin(requesterUser, eq(requesterUser.id, introRequest.requesterId))
    .where(and(isDeliveredToIntroducer(database, memberId), inArray(introRequest.state, OPEN_INTRO_STATES)));
  return waiting?.value ?? 0;
}

export async function readIntroCounts(database: Database, memberId: string): Promise<IntroCounts> {
  await expireDueIntros(database, memberId);
  const [waitingOnYou, updates] = await Promise.all([countWaitingOnYou(database, memberId), countUpdates(database, memberId)]);
  return { waitingOnYou, updates };
}

export function readIntroBadgeCount({ waitingOnYou, updates }: IntroCounts) {
  return waitingOnYou + updates;
}

export async function readIntroBoard(database: Database, memberId: string): Promise<IntroBoard> {
  const counts = await readIntroCounts(database, memberId);
  const [asksForYou, yourAsks] = await Promise.all([
    selectIntros(database)
      .where(isDeliveredToIntroducer(database, memberId))
      .orderBy(desc(introRequest.createdAt))
      .limit(INTRO_LIMITS.shownPerList),
    selectIntros(database)
      .where(eq(introRequest.requesterId, memberId))
      .orderBy(desc(introRequest.createdAt))
      .limit(INTRO_LIMITS.shownPerList),
  ]);
  return {
    asksForYou: asksForYou.map((row) => toIntro(row, memberId)),
    yourAsks: yourAsks.map((row) => toIntro(row, memberId)),
    counts,
  };
}

export async function readWaitingIntros(database: Database, memberId: string) {
  await expireDueIntros(database, memberId);
  const rows = await selectIntros(database)
    .where(and(isDeliveredToIntroducer(database, memberId), inArray(introRequest.state, OPEN_INTRO_STATES)))
    .orderBy(introRequest.createdAt)
    .limit(INTRO_LIMITS.shownPerList);
  const intros = rows.map((row) => toIntro(row, memberId));
  return intros.toSorted((first, second) => Number(second.state === INTRO_STATES.requested) - Number(first.state === INTRO_STATES.requested));
}

export async function markIntrosSeen(database: Database, memberId: string, introId: string | null) {
  await database
    .update(introRequest)
    .set({ requesterHasUpdate: false })
    .where(
      and(
        eq(introRequest.requesterId, memberId),
        eq(introRequest.requesterHasUpdate, true),
        introId ? eq(introRequest.id, introId) : undefined,
      ),
    );
}

export async function readIntroStateCounts(database: Database) {
  const rows = await database
    .select({ state: introRequest.state, value: count() })
    .from(introRequest)
    .groupBy(introRequest.state);
  const counts = new Map(rows.map(({ state, value }) => [state, value]));
  return Object.values(INTRO_STATES).map((state) => ({ state, count: counts.get(state) ?? 0 }));
}
