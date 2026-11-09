import "server-only";

import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";

import { introRequest } from "./schema.ts";
import { isAwaitingTarget, isConsentTokenLive, readLiveConsentHash } from "./reads-consent.ts";
import { isTargetOptedOut } from "./opt-out.ts";
import { isTargetRefusingRequester, issueConsent, saveConsentLink } from "./service-consent.ts";
import { memberBlock } from "../members/schema.ts";
import { user } from "../../platform/database/auth-schema.ts";
import { readResendConfig } from "../../platform/email/resend.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { readAskableConnectors } from "../network/service.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { type RequestContext } from "../../platform/http/request-context.ts";
import {
  INTRO_ACTION_RULES,
  INTRO_ACTIONS,
  INTRO_ERROR_CODES,
  INTRO_ROLES,
  INTRO_STATES,
  REQUESTER_STATES,
  readStatesLeadingTo,
  type ConsentEmailBody,
  type ConsentIssue,
  type CreateIntroBody,
  type Intro,
  type IntroAction,
  type IntroOutcomeBody,
  type IntroTransitionBody,
} from "./contract.ts";
import { INTRO_EMAIL_EVENTS, queueIntroEmail, type IntroEmailEvent } from "./email.ts";
import { readEmailBranding } from "../../platform/email/outbox.ts";
import { sendQueuedEmailsSoon } from "../../platform/email/outbox-sender.ts";
import { sendConsentAskEmail } from "./email-target.ts";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "./limits.ts";
import {
  CLOSES_CONSENT,
  expireDueIntros,
  hasBothParticipantsJoined,
  isOutcomeDueForRequester,
  readIntroDeadline,
  readIntroForViewer,
  readTargetDeadline,
} from "./reads.ts";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const BAD_GATEWAY_STATUS = 502;
const UNPROCESSABLE_STATUS = 422;
const CONSENT_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
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

async function readAskedConnector(context: RequestContext, { targetSlug, connectorSlug }: CreateIntroBody) {
  const askable = await readAskableConnectors(context, targetSlug);
  if (!askable) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.pathsStale,
      "Look up who can intro you to this person first. It only takes a moment.",
    );
  }
  const connector = askable.connectors.find(({ linkedinSlug, member }) => linkedinSlug === connectorSlug && member !== null);
  if (!connector?.member) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.notConnector,
      "This person can't take this intro request through the community. Look up who can intro you again.",
    );
  }
  if (!askable.targetName) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.targetUnknown,
      "Village didn't tell us who this person is, so we can't send this intro request. Try someone else.",
    );
  }
  return {
    introducerId: connector.member.id,
    introducerName: connector.name,
    introducerHeadline: connector.headline,
    introducerLinkedinSlug: connectorSlug,
    reason: connector.reason,
    targetName: askable.targetName,
    targetHeadline: askable.targetHeadline,
  };
}

export async function createIntroRequest(context: RequestContext, body: CreateIntroBody) {
  const { database, member } = context;
  const asked = await readAskedConnector(context, body);
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.ask);

  if (await isBlockedBy(context, member.id, asked.introducerId)) {
    throw new RequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.blockedByYou,
      "You blocked this member. Unblock them to ask for an intro.",
    );
  }
  const isWithheld =
    (await isBlockedBy(context, asked.introducerId, member.id)) || (await isTargetRefusingRequester(database, context.environment, member.id, body.targetSlug));

  await expireDueIntros(database, member.id);
  const createdAt = new Date();
  const branding = isWithheld ? null : await readEmailBranding(database, context.environment);
  const created = await database.transaction(async (transaction) => {
    const [inserted] = await transaction
      .insert(introRequest)
      .values({
        ...asked,
        requesterId: member.id,
        targetLinkedinSlug: body.targetSlug,
        note: body.note,
        isWithheld,
        createdAt,
        expiresAt: readIntroDeadline(createdAt),
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
  if (!(await isTargetOptedOut(context.database, context.environment, intro.target.linkedinSlug))) return;
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
        hasBothParticipantsJoined(database),
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

export async function recordIntroOutcome(context: RequestContext, { introId, outcome }: IntroOutcomeBody) {
  const { database, member } = context;
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.respond);
  const intro = await readRequiredIntro(context, introId);
  if (intro.viewerRole !== INTRO_ROLES.requester) throw introGoneError();

  const now = new Date();
  const [applied] = await database
    .update(introRequest)
    .set({ outcome, outcomeAnsweredAt: now })
    .where(and(eq(introRequest.id, introId), isOutcomeDueForRequester(member.id, now)))
    .returning({ id: introRequest.id });
  const current = await readRequiredIntro(context, introId);
  if (applied || current.outcome === outcome) return current;
  throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.changed, INTRO_CHANGED_MESSAGE);
}
