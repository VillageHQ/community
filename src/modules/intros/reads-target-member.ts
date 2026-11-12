import "server-only";

import { and, count, desc, eq, exists, ne, notExists, or, sql } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { memberBlock, memberNetwork, memberProfile } from "../members/schema.ts";
import { shownFaceColumns, toShownFaceUrl } from "../members/reads-pictures.ts";
import type { IntroForTarget } from "./contract.ts";
import { readWhyTheyWrote } from "./copy.ts";
import { isAwaitingTarget } from "./reads-consent.ts";
import { introConsentLink, introRequest } from "./schema.ts";

// INTRO-06: when the person asked for is a member, they see the ask in the app (Today, Your intros) and answer there,
// as well as by the emailed link. A member is that person only on facts they can't simply claim: their own address,
// verified, is the one the connector or the asker gave for the person; or their LinkedIn, confirmed, is the person's.
// Never the asker or the connector, and never across a block with the asker.

const targetUser = user;

function hasTrustedEmailFor(connection: DatabaseOrTransaction, memberId: string) {
  const trustedMatch = connection
    .select({ id: targetUser.id })
    .from(targetUser)
    .leftJoin(memberNetwork, eq(memberNetwork.userId, targetUser.id))
    .where(
      and(
        eq(targetUser.id, memberId),
        or(eq(targetUser.emailVerified, true), eq(memberNetwork.approvedMemberEmail, targetUser.email)),
        or(sql`${targetUser.email} = lower(${introRequest.targetEmail})`, sql`${targetUser.email} = lower(${introRequest.suggestedTargetEmail})`),
      ),
    );
  return exists(trustedMatch);
}

function hasConfirmedLinkedinFor(connection: DatabaseOrTransaction, memberId: string) {
  const confirmedMatch = connection
    .select({ id: memberNetwork.userId })
    .from(memberNetwork)
    .where(and(eq(memberNetwork.userId, memberId), eq(memberNetwork.linkedinSlug, introRequest.targetLinkedinSlug), eq(memberNetwork.linkedinConfirmedSlug, memberNetwork.linkedinSlug)));
  return exists(confirmedMatch);
}

function hasNoBlockWithRequester(connection: DatabaseOrTransaction, memberId: string) {
  return notExists(
    connection
      .select({ blockerId: memberBlock.blockerId })
      .from(memberBlock)
      .where(
        or(
          and(eq(memberBlock.blockerId, memberId), eq(memberBlock.blockedId, introRequest.requesterId)),
          and(eq(memberBlock.blockerId, introRequest.requesterId), eq(memberBlock.blockedId, memberId)),
        ),
      ),
  );
}

// The intro waits on its person's answer, and `memberId` is that person.
export function isAwaitingMemberAsTarget(connection: DatabaseOrTransaction, memberId: string, now: Date) {
  return and(
    isAwaitingTarget(connection, now),
    ne(introRequest.requesterId, memberId),
    ne(introRequest.introducerId, memberId),
    or(hasTrustedEmailFor(connection, memberId), hasConfirmedLinkedinFor(connection, memberId)),
    hasNoBlockWithRequester(connection, memberId),
    exists(connection.select({ introId: introConsentLink.introId }).from(introConsentLink).where(eq(introConsentLink.introId, introRequest.id))),
  );
}

// What the member sees: the same words as the emailed page (who asks, through whom, why), never an address.
export async function readIntrosForTarget(database: Database, memberId: string, now = new Date()): Promise<IntroForTarget[]> {
  const rows = await database
    .select({
      id: introRequest.id,
      requesterId: introRequest.requesterId,
      requesterName: user.name,
      requesterTitle: memberProfile.title,
      requesterCompany: memberProfile.company,
      ...shownFaceColumns(introRequest.requesterId),
      introducerName: introRequest.introducerName,
      targetName: introRequest.targetName,
      note: introRequest.note,
      createdAt: introRequest.createdAt,
      expiresAt: introRequest.expiresAt,
    })
    .from(introRequest)
    .innerJoin(user, eq(user.id, introRequest.requesterId))
    .leftJoin(memberProfile, eq(memberProfile.userId, introRequest.requesterId))
    .where(isAwaitingMemberAsTarget(database, memberId, now))
    .orderBy(desc(introRequest.createdAt));
  return rows.map((row) => ({
    id: row.id,
    requester: {
      id: row.requesterId,
      name: removeBidiControls(row.requesterName),
      headline: removeBidiControls([row.requesterTitle, row.requesterCompany].filter(Boolean).join(", ")) || null,
      avatarUrl: toShownFaceUrl(row.requesterId, row.avatarUpdatedAt, row.filledFace),
    },
    introducerName: row.introducerName,
    note: readWhyTheyWrote(row.note, row.introducerName, row.targetName),
    createdAt: row.createdAt.toISOString(),
    closesAt: row.expiresAt.toISOString(),
  }));
}

// One live consent link of an intro waiting on this member, so the in-app answer runs exactly the emailed link's path.
export async function readMemberConsentHash(database: Database, memberId: string, introId: string, now = new Date()) {
  const [row] = await database
    .select({ tokenHash: introConsentLink.tokenHash, email: user.email })
    .from(introConsentLink)
    .innerJoin(introRequest, eq(introRequest.id, introConsentLink.introId))
    .innerJoin(user, eq(user.id, memberId))
    .where(and(eq(introConsentLink.introId, introId), isAwaitingMemberAsTarget(database, memberId, now)))
    .orderBy(desc(introConsentLink.createdAt))
    .limit(1);
  return row ?? null;
}

export async function countIntrosForTarget(database: Database, memberId: string, now = new Date()) {
  const [row] = await database.select({ waiting: count() }).from(introRequest).where(isAwaitingMemberAsTarget(database, memberId, now));
  return row?.waiting ?? 0;
}
