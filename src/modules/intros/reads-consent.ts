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
import { INTRO_STATES } from "./contract.ts";
import { readWhyTheyWrote } from "./copy.ts";
import { recordFailedConsentAttempt } from "./limits.ts";
import { introRequest } from "./schema.ts";

export const CONSENT_VIEWS = { open: "open", closed: "closed", tooManyTries: "too_many_tries", notForYou: "not_for_you" } as const;

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

export function isConsentTokenLive(connection: DatabaseOrTransaction, tokenHash: string, now: Date) {
  return and(
    eq(introRequest.consentTokenHash, tokenHash),
    eq(introRequest.state, INTRO_STATES.askingTarget),
    eq(introRequest.isWithheld, false),
    gt(introRequest.expiresAt, now),
    inArray(introRequest.requesterId, selectActiveJoinedMemberIds(connection, now)),
    inArray(introRequest.introducerId, selectActiveJoinedMemberIds(connection, now)),
    hasNoBlockBetweenParticipants(connection),
  );
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

export async function readConsentView(context: ConsentViewContext, token: string) {
  const { database, readViewerId } = context;
  const tokenHash = readLiveConsentHash(token);
  if (!tokenHash) return readClosedView(context);

  const now = new Date();
  const [row] = await database
    .select({
      storedHash: introRequest.consentTokenHash,
      requesterId: introRequest.requesterId,
      introducerId: introRequest.introducerId,
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
    .where(isConsentTokenLive(database, tokenHash, now));
  if (!row?.storedHash || !secretsMatch(row.storedHash, tokenHash)) return readClosedView(context);

  const viewerId = await readViewerId();
  if (viewerId && [row.requesterId, row.introducerId].includes(viewerId)) {
    return { view: CONSENT_VIEWS.notForYou, targetName: row.targetName };
  }
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
