import "server-only";

import { and, count, eq, gt, gte, inArray, isNotNull, isNull, lte, or } from "drizzle-orm";

import { introRequest } from "./schema.ts";
import { isAwaitingTarget, isConsentTokenLive, readLiveConsentHash } from "./reads-consent.ts";
import { isTargetOptedOut } from "./opt-out.ts";
import { isTargetRefusingRequester, issueConsent, saveConsentLink } from "./service-consent.ts";
import { memberBlock, memberNetwork, memberProfile } from "../members/schema.ts";
import { readAcceptsIntroAsks } from "../members/service-privacy.ts";
import type { Transaction } from "../../platform/database/client.ts";
import { user } from "../../platform/database/auth-schema.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import type { Database } from "../../platform/database/client.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { type RequestContext } from "../../platform/http/request-context.ts";
import {
  INTRO_ACTION_RULES,
  INTRO_ACTIONS,
  INTRO_ERROR_CODES,
  INTRO_LIMITS,
  INTRO_ROLES,
  INTRO_STATES,
  REQUESTER_STATES,
  readStatesLeadingTo,
  isNamedIntroBody,
  readNamedTargetKey,
  type ConsentEmailBody,
  type ConsentIssue,
  type CreateIntroBody,
  type Intro,
  type IntroAction,
  type IntroOutcomeBody,
  type IntroTransitionBody,
  type NamedIntroBody,
  type PathIntroBody,
} from "./contract.ts";
import { INTRO_EMAIL_EVENTS, queueIntroEmail, type IntroEmailEvent } from "./email.ts";
import { readEmailBranding } from "../../platform/email/outbox.ts";
import { sendQueuedEmailsSoon } from "../../platform/email/outbox-sender.ts";
import { sendConsentAskEmail } from "./email-target.ts";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "./limits.ts";
import {
  CLOSES_CONSENT,
  expireDueIntros,
  hasConnectorJoined,
  isOutcomeDueForRequester,
  readIntroDeadline,
  readIntroForViewer,
  readTargetDeadline,
} from "./reads.ts";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const FORBIDDEN_STATUS = 403;
const BAD_GATEWAY_STATUS = 502;
const UNPROCESSABLE_STATUS = 422;
const CONSENT_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const CONNECTOR_WEEKLY_CAP = 10;
const INTRO_CHANGED_MESSAGE = "This intro request just changed. Here's where it stands now.";

export function introGoneError() {
  return new RequestError(NOT_FOUND_STATUS, INTRO_ERROR_CODES.notFound, "This intro request isn't available.");
}

async function isBlockedBy(context: RequestContext, blockerId: string, blockedId: string) {
  const [block] = await context.database
    .select({ blockerId: memberBlock.blockerId })
    .from(memberBlock)
    .where(and(eq(memberBlock.blockerId, blockerId), eq(memberBlock.blockedId, blockedId)));
  return block !== undefined;
}

async function readRequiredIntro(context: RequestContext, introId: string) {
  const intro = await readIntroForViewer(context.database, context.member.id, introId);
  if (!intro) throw introGoneError();
  return intro;
}

// What an ask copies about its connector and the person, from a Village path or from the asker's own words.
export type AskedConnector = {
  introducerId: string;
  introducerName: string;
  introducerHeadline: string | null;
  introducerLinkedinSlug: string | null;
  reason: string;
  targetName: string;
  targetHeadline: string | null;
};

// The Village network, passed in by the shell while the Network module is on; null when it is off. Intros never
// imports network: paths are an extra way in, and "chosen introducers" is a Village setting.
export type IntroNetwork = {
  readPathAsk: (context: RequestContext, body: PathIntroBody) => Promise<AskedConnector>;
  canIntroduce: (database: Database, memberId: string) => Promise<boolean>;
};

function networkOffError() {
  return new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.networkOff, "Search is off in this community. Ask a member from their profile instead.");
}

function namedConnectorGone() {
  return new RequestError(NOT_FOUND_STATUS, INTRO_ERROR_CODES.notConnector, "This member can't take intro asks right now.");
}

async function readNamedConnector(context: RequestContext, { connectorId, target }: NamedIntroBody, network: IntroNetwork | null): Promise<AskedConnector> {
  if (connectorId === context.member.id) throw namedConnectorGone();
  const [connector] = await context.database
    .select({ id: user.id, name: user.name, email: user.email, title: memberProfile.title, company: memberProfile.company, linkedinSlug: memberNetwork.linkedinSlug })
    .from(user)
    .leftJoin(memberProfile, eq(memberProfile.userId, user.id))
    .leftJoin(memberNetwork, eq(memberNetwork.userId, user.id))
    .where(and(eq(user.id, connectorId), isActiveMember()));
  if (!connector) throw namedConnectorGone();
  if (network && !(await network.canIntroduce(context.database, connector.id))) {
    throw new RequestError(FORBIDDEN_STATUS, INTRO_ERROR_CODES.notIntroducer, "In this community, intros go through members the admins chose. Ask one of them.");
  }
  const ownSlugs = [connector.linkedinSlug, await readRequesterSlug(context, context.member.id)].filter(Boolean);
  if (target.linkedin && ownSlugs.includes(target.linkedin)) {
    throw new RequestError(UNPROCESSABLE_STATUS, INTRO_ERROR_CODES.ownTarget, "That's one of you two. Name the person you'd like to meet.");
  }
  if (target.email && (await isOwnAddress(context, [context.member.id, connector.id], target.email))) {
    throw new RequestError(UNPROCESSABLE_STATUS, INTRO_ERROR_CODES.targetEmailRefused, `That address belongs to one of you two. Enter ${target.name}'s email.`);
  }
  const introducerName = connector.name.slice(0, INTRO_LIMITS.nameLength);
  return {
    introducerId: connector.id,
    introducerName,
    introducerHeadline: [connector.title, connector.company].filter(Boolean).join(", ").slice(0, INTRO_LIMITS.headlineLength) || null,
    introducerLinkedinSlug: connector.linkedinSlug,
    reason: `Asked from ${introducerName}'s profile`.slice(0, INTRO_LIMITS.reasonLength),
    targetName: target.name,
    targetHeadline: [target.role, target.company].filter(Boolean).join(", ").slice(0, INTRO_LIMITS.headlineLength) || null,
  };
}

async function readAskedPerson(context: RequestContext, body: CreateIntroBody, network: IntroNetwork | null) {
  if (isNamedIntroBody(body)) return readNamedConnector(context, body, network);
  if (!network) throw networkOffError();
  return network.readPathAsk(context, body);
}

// What a create writes about the person asked for, beside the connector.
function readTargetColumns(body: CreateIntroBody) {
  if (!isNamedIntroBody(body)) return { targetLinkedinSlug: body.targetSlug, isNamedTarget: false, suggestedTargetEmail: null };
  return { targetLinkedinSlug: readNamedTargetKey(body.target), isNamedTarget: true, suggestedTargetEmail: body.target.email };
}

// Checks the member's weekly allowance inside the create transaction. The shell passes it, because asks share it.
export type IntroAllowanceCheck = (transaction: Transaction, memberId: string) => Promise<void>;
export type CreateIntroOptions = { assertAllowance: IntroAllowanceCheck; network: IntroNetwork | null; askId?: string | null };

// Both rows are locked in one order, so two members asking each other at once can't deadlock.
async function lockMembers(transaction: Transaction, memberIds: string[]) {
  await transaction
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.id, memberIds.toSorted()))
    .orderBy(user.id)
    .for("no key update");
}

// A connector gets at most CONNECTOR_WEEKLY_CAP intro asks a week, so nobody becomes everyone's pitch inbox. Intros a
// connector offered themselves, and asks nobody showed them, don't count.
async function assertConnectorHasRoom(transaction: Transaction, introducerId: string, introducerName: string, now: Date) {
  const [row] = await transaction
    .select({ received: count() })
    .from(introRequest)
    .where(
      and(
        eq(introRequest.introducerId, introducerId),
        eq(introRequest.isConnectorOffer, false),
        eq(introRequest.isWithheld, false),
        gte(introRequest.createdAt, new Date(now.getTime() - WEEK_MS)),
      ),
    );
  if ((row?.received ?? 0) < CONNECTOR_WEEKLY_CAP) return;
  throw new RequestError(
    CONFLICT_STATUS,
    INTRO_ERROR_CODES.connectorBusy,
    `${introducerName} has had a lot of intro asks this week. Try someone else, or ask again next week.`,
  );
}

export async function createIntroRequest(context: RequestContext, body: CreateIntroBody, options: CreateIntroOptions) {
  const { database, member } = context;
  const asked = await readAskedPerson(context, body, options.network);
  const targetColumns = readTargetColumns(body);
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.ask);

  if (await isBlockedBy(context, member.id, asked.introducerId)) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.blockedByYou,
      "You blocked this member. Unblock them to ask for an intro.",
    );
  }
  if (!(await readAcceptsIntroAsks(database, asked.introducerId))) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.notTakingAsks,
      `${asked.introducerName} doesn't take intro asks here. Try someone else on the list.`,
    );
  }
  const isWithheld =
    (await isBlockedBy(context, asked.introducerId, member.id)) || (await isTargetRefusingRequester(database, context.environment, member.id, targetColumns.targetLinkedinSlug));

  await expireDueIntros(database, member.id);
  const createdAt = new Date();
  const branding = isWithheld ? null : await readEmailBranding(database, context.environment);
  const created = await database.transaction(async (transaction) => {
    await lockMembers(transaction, [member.id, asked.introducerId]);
    await options.assertAllowance(transaction, member.id);
    if (!isWithheld) await assertConnectorHasRoom(transaction, asked.introducerId, asked.introducerName, createdAt);
    const [inserted] = await transaction
      .insert(introRequest)
      .values({
        ...asked,
        ...targetColumns,
        requesterId: member.id,
        note: body.note,
        isWithheld,
        createdAt,
        expiresAt: readIntroDeadline(createdAt),
        askId: options.askId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: introRequest.id });
    if (inserted) await queueIntroEmail(transaction, context.environment, branding, inserted.id, INTRO_EMAIL_EVENTS.asked);
    return inserted;
  });
  if (!created) {
    throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.duplicate, "You already have an open intro request with this person for this intro.");
  }

  if (branding) sendQueuedEmailsSoon(database, context.environment);
  return readRequiredIntro(context, created.id);
}

const ACTION_EMAILS: Partial<Record<IntroAction, IntroEmailEvent>> = {
  [INTRO_ACTIONS.decline]: INTRO_EMAIL_EVENTS.declined,
};

function readTransitionPatch(body: IntroTransitionBody, currentDeadline: Date, now: Date) {
  const { nextState } = INTRO_ACTION_RULES[body.action];
  const patches: Record<IntroAction, Partial<typeof introRequest.$inferInsert>> = {
    [INTRO_ACTIONS.accept]: { askedTargetAt: now, expiresAt: readTargetDeadline(currentDeadline, now) },
    [INTRO_ACTIONS.decline]: {
      closedAt: now,
      requesterHasUpdate: true,
      declineReason: body.action === INTRO_ACTIONS.decline ? body.reason : null,
      declineKind: body.action === INTRO_ACTIONS.decline ? body.kind : null,
      ...CLOSES_CONSENT,
    },
    [INTRO_ACTIONS.withdraw]: { closedAt: now, ...CLOSES_CONSENT },
    [INTRO_ACTIONS.complete]: { closedAt: now, requesterHasUpdate: true, ...CLOSES_CONSENT },
  };
  return { state: nextState, ...patches[body.action] };
}

async function withholdFromOptedOutTarget(context: RequestContext, intro: Intro) {
  const [row] = await context.database.select({ targetKey: introRequest.targetLinkedinSlug }).from(introRequest).where(eq(introRequest.id, intro.id));
  if (!row || !(await isTargetOptedOut(context.database, context.environment, row.targetKey))) return;
  await context.database.update(introRequest).set({ isWithheld: true }).where(eq(introRequest.id, intro.id));
  throw introGoneError();
}

export async function transitionIntro(context: RequestContext, body: IntroTransitionBody) {
  const { database, member, environment } = context;
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.respond);

  const intro = await readRequiredIntro(context, body.introId);
  const { nextState, actor } = INTRO_ACTION_RULES[body.action];
  if (intro.viewerRole !== actor) throw introGoneError();

  const isAccepting = body.action === INTRO_ACTIONS.accept;
  if (isAccepting) await withholdFromOptedOutTarget(context, intro);
  const issued = isAccepting ? issueConsent(environment) : null;

  const now = new Date();
  const isRequesterActing = actor === INTRO_ROLES.requester;
  const actorColumn = isRequesterActing ? introRequest.requesterId : introRequest.introducerId;
  const emailEvent = ACTION_EMAILS[body.action];
  const branding = emailEvent ? await readEmailBranding(database, environment) : null;
  const applied = await database.transaction(async (transaction) => {
    const [moved] = await transaction
    .update(introRequest)
    .set(readTransitionPatch(body, new Date(intro.expiresAt), now))
    .where(
      and(
        eq(introRequest.id, body.introId),
        eq(actorColumn, member.id),
        inArray(introRequest.state, readStatesLeadingTo(nextState)),
        gt(introRequest.expiresAt, now),
        hasConnectorJoined(database),
        isRequesterActing ? undefined : eq(introRequest.isWithheld, false),
      ),
    )
    .returning({ id: introRequest.id });
    if (moved && issued) await saveConsentLink(transaction, moved.id, issued.tokenHash);
    if (moved && emailEvent) await queueIntroEmail(transaction, environment, branding, moved.id, emailEvent);
    return moved;
  });

  const current = await readRequiredIntro(context, body.introId);
  if (applied) {
    if (branding) sendQueuedEmailsSoon(database, environment);
    return { ...current, consentIssue: issued?.consentIssue ?? null };
  }
  const landedState = actor === INTRO_ROLES.requester ? REQUESTER_STATES[nextState] : nextState;
  if (current.state === landedState) return { ...current, consentIssue: null };
  throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.changed, INTRO_CHANGED_MESSAGE);
}

async function readAskingTargetIntro(context: RequestContext, introId: string) {
  const intro = await readRequiredIntro(context, introId);
  if (intro.viewerRole !== INTRO_ROLES.introducer) throw introGoneError();
  if (intro.state !== INTRO_STATES.askingTarget) {
    throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.changed, INTRO_CHANGED_MESSAGE);
  }
  return intro;
}

export async function makeNewConsentLink(context: RequestContext, introId: string) {
  const { database, member, environment } = context;
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.respond);
  const intro = await readAskingTargetIntro(context, introId);
  await withholdFromOptedOutTarget(context, intro);

  const { tokenHash, consentIssue } = issueConsent(environment);
  // The new link is added beside the older ones, which keep working: the connector may already have forwarded one.
  const applied = await database.transaction(async (transaction) => {
    const [stillAsking] = await transaction
      .select({ id: introRequest.id })
      .from(introRequest)
      .where(and(eq(introRequest.id, introId), eq(introRequest.introducerId, member.id), isAwaitingTarget(transaction, new Date())))
      .for("update");
    if (stillAsking) await saveConsentLink(transaction, stillAsking.id, tokenHash);
    return stillAsking;
  });
  if (!applied) throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.changed, INTRO_CHANGED_MESSAGE);
  return { ...intro, consentIssue } satisfies Intro & { consentIssue: ConsentIssue };
}

async function isOwnAddress({ database }: RequestContext, memberIds: readonly string[], email: string) {
  const [match] = await database
    .select({ id: user.id })
    .from(user)
    .where(and(inArray(user.id, [...memberIds]), eq(user.email, email)));
  return match !== undefined;
}

export async function emailConsentLink(context: RequestContext, { introId, token, targetEmail }: ConsentEmailBody) {
  const { database, member, environment } = context;
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.respond);
  const intro = await readAskingTargetIntro(context, introId);
  await withholdFromOptedOutTarget(context, intro);

  if (await isOwnAddress(context, [intro.requester.id, intro.introducer.id], targetEmail)) {
    throw new RequestError(UNPROCESSABLE_STATUS, INTRO_ERROR_CODES.targetEmailRefused, `That address belongs to a member. Enter ${intro.target.name}'s email.`);
  }
  if (!readResendConfig(environment)) {
    throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.targetEmailRefused, "This community doesn't send email. Copy the note and send it yourself.");
  }
  const tokenHash = readLiveConsentHash(token) ?? "";
  const now = new Date();
  const emailedBefore = new Date(now.getTime() - CONSENT_EMAIL_COOLDOWN_MS);
  const [previous] = await database
    .select({ targetEmail: introRequest.targetEmail, consentEmailAt: introRequest.consentEmailAt })
    .from(introRequest)
    .where(eq(introRequest.id, introId));
  const isStillPrevious = previous?.consentEmailAt ? eq(introRequest.consentEmailAt, previous.consentEmailAt) : isNull(introRequest.consentEmailAt);
  const [claimed] = await database
    .update(introRequest)
    .set({ targetEmail, consentEmailAt: now })
    .where(
      and(
        eq(introRequest.id, introId),
        isConsentTokenLive(database, tokenHash, now),
        isStillPrevious,
        or(isNull(introRequest.consentEmailAt), lte(introRequest.consentEmailAt, emailedBefore)),
      ),
    )
    .returning({ id: introRequest.id });
  if (!claimed) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.targetEmailRefused,
      "We can't send this right now. We email a link at most once a day, while the intro waits on their answer.",
    );
  }

  try {
    await sendConsentAskEmail(database, environment, { intro, token, targetEmail });
  } catch (error) {
    logError("intro-consent-email", error);
    // Undo only our own claim, and only while the intro still waits on the target: if they answered in the meantime
    // (through a forwarded link), their saved address and state stay as they are. An earlier email that did go out
    // keeps its address, so a later yes can still join them by email.
    await database
      .update(introRequest)
      .set({ targetEmail: previous?.targetEmail ?? null, consentEmailAt: previous?.consentEmailAt ?? null })
      .where(and(eq(introRequest.id, introId), eq(introRequest.state, INTRO_STATES.askingTarget), eq(introRequest.consentEmailAt, now)));
    throw new RequestError(BAD_GATEWAY_STATUS, INTRO_ERROR_CODES.targetEmailFailed, "We couldn't send that email. Copy the note and send it yourself.");
  }
  return { message: `We emailed ${intro.target.name}.` };
}

export async function recordIntroOutcome(context: RequestContext, { introId, outcome, results }: IntroOutcomeBody) {
  const { database, member } = context;
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.respond);
  const intro = await readRequiredIntro(context, introId);
  if (intro.viewerRole !== INTRO_ROLES.requester) throw introGoneError();

  const now = new Date();
  const [applied] = await database
    .update(introRequest)
    .set({ outcome, outcomeResults: results.length > 0 ? results : null, outcomeAnsweredAt: now })
    .where(and(eq(introRequest.id, introId), isOutcomeDueForRequester(member.id, now)))
    .returning({ id: introRequest.id });
  const current = await readRequiredIntro(context, introId);
  if (applied || current.outcome === outcome) return current;
  throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.changed, INTRO_CHANGED_MESSAGE);
}

export type OfferedIntroBody = { requesterId: string; askId: string; targetSlug: string; targetName: string; note: string };

const NOT_JOINED_MESSAGE = "Intros go through the community network. You need to have joined it on the Network page to introduce someone.";

async function readJoinedNetwork(context: RequestContext, memberId: string) {
  const [row] = await context.database
    .select({ linkedinSlug: memberNetwork.linkedinSlug, title: memberProfile.title, company: memberProfile.company, name: user.name })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .leftJoin(memberProfile, eq(memberProfile.userId, memberNetwork.userId))
    .where(and(eq(memberNetwork.userId, memberId), isNotNull(memberNetwork.groupJoinedAt)));
  return row?.linkedinSlug ? { ...row, linkedinSlug: row.linkedinSlug } : null;
}

// The asker of an offered intro needn't have joined: members can ask before sharing their own network.
async function readRequesterSlug(context: RequestContext, memberId: string) {
  const [row] = await context.database.select({ linkedinSlug: memberNetwork.linkedinSlug }).from(memberNetwork).where(eq(memberNetwork.userId, memberId));
  return row?.linkedinSlug ?? null;
}

// "I know someone" on an ask: the helper is the connector and has already said yes by offering, so the intro starts
// waiting on the target. The helper then makes the consent link on the Intros page, as after any yes.
export async function createOfferedIntro(context: RequestContext, body: OfferedIntroBody, network: IntroNetwork | null) {
  const { database, member, environment } = context;
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.ask);
  const [connector, requesterSlug] = await Promise.all([readJoinedNetwork(context, member.id), readRequesterSlug(context, body.requesterId)]);
  if (!connector) throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.notJoined, NOT_JOINED_MESSAGE);
  if (network && !(await network.canIntroduce(database, member.id))) {
    throw new RequestError(FORBIDDEN_STATUS, INTRO_ERROR_CODES.notIntroducer, "In this community, intros go through members the admins chose. Ask one of them, or post your lead on the ask.");
  }
  if (body.targetSlug === connector.linkedinSlug || body.targetSlug === requesterSlug) {
    throw new RequestError(UNPROCESSABLE_STATUS, INTRO_ERROR_CODES.ownTarget, "That's one of you two. Name the person you'd introduce them to.");
  }
  if (await isTargetRefusingRequester(database, environment, body.requesterId, body.targetSlug)) {
    throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.targetRefuses, "This person asked not to get intro asks through this community.");
  }

  const now = new Date();
  const [created] = await database
    .insert(introRequest)
    .values({
      requesterId: body.requesterId,
      introducerId: member.id,
      targetLinkedinSlug: body.targetSlug,
      targetName: body.targetName,
      targetHeadline: null,
      introducerName: connector.name,
      introducerHeadline: [connector.title, connector.company].filter(Boolean).join(", ") || null,
      introducerLinkedinSlug: connector.linkedinSlug,
      reason: `${connector.name} offered this intro on an ask`.slice(0, INTRO_LIMITS.reasonLength),
      note: body.note,
      state: INTRO_STATES.askingTarget,
      requesterHasUpdate: true,
      createdAt: now,
      askedTargetAt: now,
      expiresAt: readTargetDeadline(readIntroDeadline(now), now),
      askId: body.askId,
      isConnectorOffer: true,
    })
    .onConflictDoNothing()
    .returning({ id: introRequest.id });
  if (!created) {
    throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.duplicate, "You already have an open intro for them with this person.");
  }
  return created;
}
