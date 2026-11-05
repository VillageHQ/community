import "server-only";

import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { recordOutsiderAction } from "../../platform/audit/record.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import type { Database, Transaction } from "../../platform/database/client.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { runAfterResponse } from "../../platform/observability/after-response.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { createInviteToken, hashInviteToken } from "../members/service-invite-token.ts";
import { CONSENT_ANSWERS, INTRO_ERROR_CODES, INTRO_STATES, type ConsentAnswer, type ConsentAnswerBody } from "./contract.ts";
import { deliverIntroEmail, INTRO_EMAIL_EVENTS, type IntroEmailEvent } from "./email.ts";
import { sendJoiningEmail } from "./email-target.ts";
import { recordFailedConsentAttempt } from "./limits.ts";
import { CLOSES_CONSENT, readIntroDeadline } from "./reads.ts";
import { readConsentParticipants, isConsentTokenLive, readLiveConsentHash } from "./reads-consent.ts";
import { introOptOut, introRequest } from "./schema.ts";

const FORBIDDEN_STATUS = 403;
const GONE_STATUS = 410;
const TOO_MANY_REQUESTS_STATUS = 429;

function hashTargetSlug(targetSlug: string) {
  return createHash("sha256").update(`intro-opt-out:${targetSlug}`).digest("hex");
}

export function issueConsent(environment: Environment) {
  const token = createInviteToken();
  return {
    tokenHash: hashInviteToken(token),
    consentIssue: {
      token,
      link: `${resolveAppUrl(environment)}${ROUTES.introConsent}/${token}`,
      canEmailTarget: readResendConfig(environment) !== null,
    },
  };
}

export async function isTargetOptedOut(database: Database, targetSlug: string) {
  const [optOut] = await database
    .select({ targetSlugHash: introOptOut.targetSlugHash })
    .from(introOptOut)
    .where(eq(introOptOut.targetSlugHash, hashTargetSlug(targetSlug)));
  return optOut !== undefined;
}

export async function isTargetRefusingRequester(database: Database, requesterId: string, targetSlug: string) {
  if (await isTargetOptedOut(database, targetSlug)) return true;
  const [refusal] = await database
    .select({ id: introRequest.id })
    .from(introRequest)
    .where(
      and(
        eq(introRequest.requesterId, requesterId),
        eq(introRequest.targetLinkedinSlug, targetSlug),
        eq(introRequest.state, INTRO_STATES.targetDeclined),
      ),
    );
  return refusal !== undefined;
}

type IntroFacts = typeof introRequest.$inferSelect;

function toEmailFacts(intro: IntroFacts, requesterName: string, event: IntroEmailEvent) {
  return {
    introId: intro.id,
    event,
    requesterId: intro.requesterId,
    introducerId: intro.introducerId,
    requesterName,
    introducerName: intro.introducerName,
    targetName: intro.targetName,
  };
}

function closedLinkError() {
  return new RequestError(GONE_STATUS, INTRO_ERROR_CODES.consentLinkClosed, "This link isn't open any more. There's nothing you need to do.");
}

async function respondToFailedAttempt(database: Database, request: Request, environment: Environment): Promise<never> {
  const { isLimited } = await recordFailedConsentAttempt(database, request, environment);
  if (isLimited) {
    throw new RequestError(TOO_MANY_REQUESTS_STATUS, INTRO_ERROR_CODES.consentTooManyTries, "Too many tries with this link. Wait a minute and try again.");
  }
  throw closedLinkError();
}

async function closeTargetsOtherAsks(transaction: Transaction, targetSlug: string, requesterId: string | null, now: Date) {
  const sameTarget = eq(introRequest.targetLinkedinSlug, targetSlug);
  const sameRequester = requesterId ? eq(introRequest.requesterId, requesterId) : undefined;
  await transaction
    .update(introRequest)
    .set({ isWithheld: true })
    .where(and(sameTarget, sameRequester, eq(introRequest.state, INTRO_STATES.requested)));
  return transaction
    .update(introRequest)
    .set({ state: INTRO_STATES.targetDeclined, closedAt: now, requesterHasUpdate: true, ...CLOSES_CONSENT })
    .where(and(sameTarget, sameRequester, eq(introRequest.state, INTRO_STATES.askingTarget)))
    .returning();
}

async function saveOptOut(transaction: Transaction, targetSlug: string) {
  await transaction.insert(introOptOut).values({ targetSlugHash: hashTargetSlug(targetSlug) }).onConflictDoNothing();
  await recordOutsiderAction(transaction, AUDIT_ACTIONS.introAsksStopped);
}

type AnswerFacts = { database: Database; tokenHash: string; now: Date };

async function saveYes({ database, tokenHash, now }: AnswerFacts) {
  const [agreed] = await database
    .update(introRequest)
    .set({
      state: INTRO_STATES.targetAgreed,
      targetAgreedAt: now,
      expiresAt: readIntroDeadline(now),
      requesterHasUpdate: true,
      consentTokenHash: null,
    })
    .where(isConsentTokenLive(database, tokenHash, now))
    .returning();
  return agreed ? { agreed, refused: [] } : null;
}

function saveNo({ database, tokenHash, now }: AnswerFacts, isStoppingAllAsks: boolean) {
  return database.transaction(async (transaction) => {
    const [refused] = await transaction
      .update(introRequest)
      .set({ state: INTRO_STATES.targetDeclined, closedAt: now, requesterHasUpdate: true, ...CLOSES_CONSENT })
      .where(isConsentTokenLive(transaction, tokenHash, now))
      .returning();
    if (!refused) return null;
    if (isStoppingAllAsks) await saveOptOut(transaction, refused.targetLinkedinSlug);
    const others = await closeTargetsOtherAsks(transaction, refused.targetLinkedinSlug, isStoppingAllAsks ? null : refused.requesterId, now);
    return { agreed: null, refused: [refused, ...others] };
  });
}

const SAVES_ANSWER: Record<ConsentAnswer, (facts: AnswerFacts) => ReturnType<typeof saveYes | typeof saveNo>> = {
  [CONSENT_ANSWERS.yes]: saveYes,
  [CONSENT_ANSWERS.noThanks]: (facts) => saveNo(facts, false),
  [CONSENT_ANSWERS.stopAllAsks]: (facts) => saveNo(facts, true),
};

async function completeJoinedIntro(database: Database, introId: string, now: Date) {
  await database
    .update(introRequest)
    .set({ state: INTRO_STATES.completed, closedAt: now, requesterHasUpdate: true, ...CLOSES_CONSENT })
    .where(and(eq(introRequest.id, introId), eq(introRequest.state, INTRO_STATES.targetAgreed), eq(introRequest.isWithheld, false)));
}

async function tryJoiningByEmail(database: Database, environment: Environment, intro: IntroFacts, requesterName: string) {
  if (!intro.targetEmail || !readResendConfig(environment)) return false;
  try {
    await sendJoiningEmail(database, environment, intro, requesterName);
    await completeJoinedIntro(database, intro.id, new Date());
    return true;
  } catch (error) {
    logError("intro-joining-email", error);
    return false;
  }
}

async function tellEveryoneAboutYes(database: Database, environment: Environment, intro: IntroFacts) {
  const { requesterName } = await readConsentParticipants(database, intro.requesterId);
  if (await tryJoiningByEmail(database, environment, intro, requesterName)) {
    await deliverIntroEmail(database, environment, toEmailFacts(intro, requesterName, INTRO_EMAIL_EVENTS.joined));
    return;
  }
  await Promise.all([
    deliverIntroEmail(database, environment, toEmailFacts(intro, requesterName, INTRO_EMAIL_EVENTS.targetAgreed)),
    deliverIntroEmail(database, environment, toEmailFacts(intro, requesterName, INTRO_EMAIL_EVENTS.joinNeeded)),
  ]);
}

async function tellEveryoneAboutNo(database: Database, environment: Environment, intros: readonly IntroFacts[]) {
  await Promise.all(
    intros.map(async (intro) => {
      const { requesterName } = await readConsentParticipants(database, intro.requesterId);
      await Promise.all([
        deliverIntroEmail(database, environment, toEmailFacts(intro, requesterName, INTRO_EMAIL_EVENTS.declined)),
        deliverIntroEmail(database, environment, toEmailFacts(intro, requesterName, INTRO_EMAIL_EVENTS.targetDeclined)),
      ]);
    }),
  );
}

type AnswerContext = { database: Database; environment: Environment; request: Request; viewerId: string | null };

export async function answerConsentAsk({ database, environment, request, viewerId }: AnswerContext, { token, answer }: ConsentAnswerBody) {
  const tokenHash = readLiveConsentHash(token);
  if (!tokenHash) return respondToFailedAttempt(database, request, environment);

  const now = new Date();
  const [held] = await database
    .select({ requesterId: introRequest.requesterId, introducerId: introRequest.introducerId, targetName: introRequest.targetName })
    .from(introRequest)
    .where(isConsentTokenLive(database, tokenHash, now));
  if (!held) return respondToFailedAttempt(database, request, environment);
  if (viewerId && [held.requesterId, held.introducerId].includes(viewerId)) {
    throw new RequestError(FORBIDDEN_STATUS, INTRO_ERROR_CODES.consentLinkNotForYou, `This link is for ${held.targetName}, so we didn't change anything.`);
  }

  const saved = await SAVES_ANSWER[answer]({ database, tokenHash, now });
  if (!saved) return respondToFailedAttempt(database, request, environment);

  const { agreed, refused } = saved;
  runAfterResponse(() => (agreed ? tellEveryoneAboutYes(database, environment, agreed) : tellEveryoneAboutNo(database, environment, refused)));
  return { answer };
}
