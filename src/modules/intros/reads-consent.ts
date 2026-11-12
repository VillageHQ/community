import "server-only";

import { and, eq, gt, inArray, isNotNull, notExists, or } from "drizzle-orm";
import { z } from "zod";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction } from "../../platform/database/client.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import { isReplyByEmailOn } from "../../platform/email/reply-address.ts";
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

// Whoever asks only needs to be an active member: since search-first, a member can ask before sharing their own
// network. The connector must have joined the group, so they shared theirs.
export function selectActiveMemberIds(connection: DatabaseOrTransaction, now: Date) {
  return connection.select({ userId: user.id }).from(user).where(isActiveMember(now));
}

export function selectActiveJoinedMemberIds(connection: DatabaseOrTransaction, now: Date) {
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

// The connector of a path ask must be active and have joined the group; a named ask (from a profile) needs no network,
// so its connector only needs to be active.
export function isActiveConnector(connection: DatabaseOrTransaction, now: Date) {
  return or(
    and(eq(introRequest.isNamedTarget, true), inArray(introRequest.introducerId, selectActiveMemberIds(connection, now))),
    inArray(introRequest.introducerId, selectActiveJoinedMemberIds(connection, now)),
  );
}

// Open, not withheld, not past its deadline, from an active member to an active connector (joined, for a path ask),
// with no block either way.
export function isLiveBetweenMembers(connection: DatabaseOrTransaction, now: Date) {
  return and(
    eq(introRequest.isWithheld, false),
    gt(introRequest.expiresAt, now),
    inArray(introRequest.requesterId, selectActiveMemberIds(connection, now)),
    isActiveConnector(connection, now),
    hasNoBlockBetweenParticipants(connection),
  );
}

export function isAwaitingTarget(connection: DatabaseOrTransaction, now: Date) {
  return and(eq(introRequest.state, INTRO_STATES.askingTarget), isLiveBetweenMembers(connection, now));
}

// Any link the connector made for this intro works while the intro waits on the target. A newer link never closes an
// older one that may already be forwarded.
export function isConsentTokenLive(connection: DatabaseOrTransaction, tokenHash: string, now: Date) {
  return and(hasConsentLink(connection, tokenHash), isAwaitingTarget(connection, now));
}

type TargetAnswerFacts = Pick<typeof introRequest.$inferSelect, "state" | "targetAgreedAt" | "targetLinkedinSlug" | "targetAnswer">;

const consentAnswerSchema = z.enum(CONSENT_ANSWERS);

async function isTargetSlugOptedOut(database: Database, environment: Environment, targetSlug: string) {
  return isSlugHashOptedOut(database, await hashTargetSlug(database, environment, targetSlug));
}

// What the target already answered, read back from the intro, or null when they never answered (expired, withdrawn).
// The saved answer wins, so a later stop-all on another intro never rewrites a "no thanks" given here. Rows from before
// answers were saved fall back to reading the state and the opt-out list.
export async function readSettledAnswer(database: Database, environment: Environment, intro: TargetAnswerFacts): Promise<ConsentAnswer | null> {
  const saved = consentAnswerSchema.safeParse(intro.targetAnswer);
  if (saved.success) return saved.data;
  if (intro.targetAgreedAt) return CONSENT_ANSWERS.yes;
  if (intro.state !== INTRO_STATES.targetDeclined) return null;
  return (await isTargetSlugOptedOut(database, environment, intro.targetLinkedinSlug)) ? CONSENT_ANSWERS.stopAllAsks : CONSENT_ANSWERS.noThanks;
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
  // A "no thanks" here, then a stop-all on another intro: the page says both, in the order they happened.
  const hasStoppedAllSince = answer === CONSENT_ANSWERS.noThanks && (await isTargetSlugOptedOut(context.database, context.environment, intro.targetLinkedinSlug));
  return { view: CONSENT_VIEWS.answered, answer, hasStoppedAllSince, requesterName, introducerName: intro.introducerName, targetName: intro.targetName };
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
    // A forwarded link: the app has no address for them, so the yes asks for one and the app joins them by email.
    asksForEmail: row.targetEmail === null && readResendConfig(context.environment) !== null,
    copiesConnector: isReplyByEmailOn(context.environment),
  };
}
