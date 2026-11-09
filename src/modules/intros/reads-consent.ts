import "server-only";

import { and, eq, gt, inArray, isNotNull, notExists, or } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { secretsMatch } from "../../platform/secrets/secrets-match.ts";
import { memberBlock, memberNetwork, memberProfile } from "../members/schema.ts";
import { hashInviteToken, isInviteTokenShape } from "../members/service-invite-token.ts";
import { CONSENT_ANSWERS, INTRO_STATES, type ConsentAnswer } from "./contract.ts";
import { readWhyTheyWrote } from "./copy.ts";
import { recordFailedConsentAttempt } from "./limits.ts";
import { hashTargetSlug, isSlugHashOptedOut } from "./opt-out.ts";
import { introConsentLink, introRequest } from "./schema.ts";

export const CONSENT_VIEWS = { open: "open", answered: "answered", closed: "closed", tooManyTries: "too_many_tries", notForYou: "not_for_you" } as const;

export function readLiveConsentHash(token: string) {
  return isInviteTokenShape(token) ? hashInviteToken(token) : null;
}

function selectActiveJoinedMemberIds(connection: DatabaseOrTransaction, now: Date) {
  return connection
    .select({ userId: memberNetwork.userId })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(and(isNotNull(memberNetwork.groupJoinedAt), isActiveMember(now)));
}

function hasNoBlockBetweenParticipants(connection: DatabaseOrTransaction) {
  const blocks = connection
    .select({ blockerId: memberBlock.blockerId })
    .from(memberBlock)
    .where(
      or(
        and(eq(memberBlock.blockerId, introRequest.introducerId), eq(memberBlock.blockedId, introRequest.requesterId)),
        and(eq(memberBlock.blockerId, introRequest.requesterId), eq(memberBlock.blockedId, introRequest.introducerId)),
      ),
    );
  return notExists(blocks);
}

function hasConsentLink(connection: DatabaseOrTransaction, tokenHash: string) {
  const linkedIntros = connection.select({ introId: introConsentLink.introId }).from(introConsentLink).where(eq(introConsentLink.tokenHash, tokenHash));
  return inArray(introRequest.id, linkedIntros);
}

export function isAwaitingTarget(connection: DatabaseOrTransaction, now: Date) {
  return and(
    eq(introRequest.state, INTRO_STATES.askingTarget),
    eq(introRequest.isWithheld, false),
    gt(introRequest.expiresAt, now),
    inArray(introRequest.requesterId, selectActiveJoinedMemberIds(connection, now)),
    inArray(introRequest.introducerId, selectActiveJoinedMemberIds(connection, now)),
    hasNoBlockBetweenParticipants(connection),
  );
}

// Any link the connector made for this intro works while the intro waits on the target. A newer link never closes an
// older one that may already be forwarded.
export function isConsentTokenLive(connection: DatabaseOrTransaction, tokenHash: string, now: Date) {
  return and(hasConsentLink(connection, tokenHash), isAwaitingTarget(connection, now));
}

type TargetAnswerFacts = Pick<typeof introRequest.$inferSelect, "state" | "targetAgreedAt" | "targetLinkedinSlug">;

// What the target already answered, read back from the intro, or null when they never answered (expired, withdrawn).
export async function readSettledAnswer(database: Database, environment: Environment, intro: TargetAnswerFacts): Promise<ConsentAnswer | null> {
  if (intro.targetAgreedAt) return CONSENT_ANSWERS.yes;
  if (intro.state !== INTRO_STATES.targetDeclined) return null;
  const isOptedOut = await isSlugHashOptedOut(database, await hashTargetSlug(database, environment, intro.targetLinkedinSlug));
  return isOptedOut ? CONSENT_ANSWERS.stopAllAsks : CONSENT_ANSWERS.noThanks;
}

// The intro a link belongs to, live or not. Null only for a token nobody issued.
export async function readLinkedIntro(connection: DatabaseOrTransaction, tokenHash: string) {
  const [linked] = await connection
    .select({ intro: introRequest, storedHash: introConsentLink.tokenHash })
    .from(introConsentLink)
    .innerJoin(introRequest, eq(introRequest.id, introConsentLink.introId))
    .where(eq(introConsentLink.tokenHash, tokenHash));
  if (!linked || !secretsMatch(linked.storedHash, tokenHash)) return null;
  return linked.intro;
}

export async function readConsentParticipants(database: Database, requesterId: string) {
  const [requester] = await database.select({ name: user.name }).from(user).where(eq(user.id, requesterId));
  return { requesterName: removeBidiControls(requester?.name ?? "") };
}

type ConsentViewContext = { database: Database; environment: Environment; headers: Headers; readViewerId: () => Promise<string | null> };

async function readClosedView({ database, environment, headers }: ConsentViewContext) {
  const { isLimited } = await recordFailedConsentAttempt(database, headers, environment);
  if (isLimited) return { view: CONSENT_VIEWS.tooManyTries };
  return { view: CONSENT_VIEWS.closed };
}

async function readAnsweredView(context: ConsentViewContext, intro: typeof introRequest.$inferSelect) {
  const answer = await readSettledAnswer(context.database, context.environment, intro);
  if (!answer) return { view: CONSENT_VIEWS.closed };
  const { requesterName } = await readConsentParticipants(context.database, intro.requesterId);
  return { view: CONSENT_VIEWS.answered, answer, requesterName, introducerName: intro.introducerName, targetName: intro.targetName };
}

export async function readConsentView(context: ConsentViewContext, token: string) {
  const { database, readViewerId } = context;
  const tokenHash = readLiveConsentHash(token);
  if (!tokenHash) return readClosedView(context);
  const linked = await readLinkedIntro(database, tokenHash);
  if (!linked) return readClosedView(context);

  const viewerId = await readViewerId();
  if (viewerId && [linked.requesterId, linked.introducerId].includes(viewerId)) {
    return { view: CONSENT_VIEWS.notForYou, targetName: linked.targetName };
  }

  const now = new Date();
  const [row] = await database
    .select({
      requesterName: user.name,
      requesterTitle: memberProfile.title,
      requesterCompany: memberProfile.company,
      introducerName: introRequest.introducerName,
      targetName: introRequest.targetName,
      note: introRequest.note,
      expiresAt: introRequest.expiresAt,
      targetEmail: introRequest.targetEmail,
    })
    .from(introRequest)
    .innerJoin(user, eq(user.id, introRequest.requesterId))
    .leftJoin(memberProfile, eq(memberProfile.userId, introRequest.requesterId))
    .where(and(eq(introRequest.id, linked.id), isAwaitingTarget(database, now)));
  if (!row) return readAnsweredView(context, linked);

  return {
    view: CONSENT_VIEWS.open,
    requesterName: removeBidiControls(row.requesterName),
    requesterHeadline: removeBidiControls([row.requesterTitle, row.requesterCompany].filter(Boolean).join(", ")) || null,
    introducerName: row.introducerName,
    targetName: row.targetName,
    note: readWhyTheyWrote(row.note, row.introducerName, row.targetName),
    closesAt: row.expiresAt.toISOString(),
    joinsByEmail: row.targetEmail !== null && readResendConfig(context.environment) !== null,
  };
}
