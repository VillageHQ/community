import "server-only";

import { and, eq, gt, inArray } from "drizzle-orm";

import { introRequest } from "../../database/intro-schema.ts";
import { memberBlock } from "../../database/messages-schema.ts";
import { runAfterResponse } from "../after-response.ts";
import { readAskableConnectors, NetworkRequestError, type NetworkContext } from "../village/member-network.ts";
import {
  INTRO_ACTION_RULES,
  INTRO_ACTIONS,
  INTRO_ERROR_CODES,
  INTRO_ROLES,
  readStatesLeadingTo,
  type CreateIntroBody,
  type Intro,
  type IntroAction,
  type IntroTransitionBody,
} from "./intro-api.ts";
import { deliverIntroEmail, INTRO_EMAIL_EVENTS, type IntroEmailEvent } from "./intro-email.ts";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "./intro-limit.ts";
import { expireDueIntros, hasBothParticipantsJoined, readIntroDeadline, readIntroForViewer } from "./intro-reads.ts";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const INTRO_CHANGED_MESSAGE = "This ask just changed. Here's where it stands now.";

export function introGoneError() {
  return new NetworkRequestError(NOT_FOUND_STATUS, INTRO_ERROR_CODES.notFound, "This ask isn't available.");
}

async function isBlockedBy(context: NetworkContext, blockerId: string, blockedId: string) {
  const [block] = await context.database
    .select({ blockerId: memberBlock.blockerId })
    .from(memberBlock)
    .where(and(eq(memberBlock.blockerId, blockerId), eq(memberBlock.blockedId, blockedId)));
  return block !== undefined;
}

function sendIntroEmail(context: NetworkContext, intro: Intro, event: IntroEmailEvent) {
  runAfterResponse(() =>
    deliverIntroEmail(context.database, context.environment, {
      introId: intro.id,
      event,
      requesterId: intro.requester.id,
      introducerId: intro.introducer.id,
      requesterName: intro.requester.name,
      introducerName: intro.introducer.name,
      targetName: intro.target.name,
    }),
  );
}

async function readRequiredIntro(context: NetworkContext, introId: string) {
  const intro = await readIntroForViewer(context.database, context.member.id, introId);
  if (!intro) throw introGoneError();
  return intro;
}

async function readAskedConnector(context: NetworkContext, { targetSlug, connectorSlug }: CreateIntroBody) {
  const askable = await readAskableConnectors(context, targetSlug);
  if (!askable) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.pathsStale,
      "Look up who can intro you to this person first. It only takes a moment.",
    );
  }
  const connector = askable.connectors.find(({ linkedinSlug, member }) => linkedinSlug === connectorSlug && member !== null);
  if (!connector?.member) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.notConnector,
      "This person can't take this ask through the community. Look up who can intro you again.",
    );
  }
  if (!askable.targetName) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.targetUnknown,
      "Village didn't tell us who this person is, so we can't send this ask. Try someone else.",
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

export async function createIntroRequest(context: NetworkContext, body: CreateIntroBody) {
  const { database, member } = context;
  const asked = await readAskedConnector(context, body);
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.ask);

  if (await isBlockedBy(context, member.id, asked.introducerId)) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      INTRO_ERROR_CODES.blockedByYou,
      "You blocked this member. Unblock them to ask for an intro.",
    );
  }
  const isWithheld = await isBlockedBy(context, asked.introducerId, member.id);

  await expireDueIntros(database, member.id);
  const [created] = await database
    .insert(introRequest)
    .values({
      ...asked,
      requesterId: member.id,
      targetLinkedinSlug: body.targetSlug,
      note: body.note,
      isWithheld,
      expiresAt: readIntroDeadline(),
    })
    .onConflictDoNothing()
    .returning({ id: introRequest.id });
  if (!created) {
    throw new NetworkRequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.duplicate, "You already have an open ask with this person for this intro.");
  }

  const intro = await readRequiredIntro(context, created.id);
  if (!isWithheld) sendIntroEmail(context, intro, INTRO_EMAIL_EVENTS.asked);
  return intro;
}

const ACTION_EMAILS: Partial<Record<IntroAction, IntroEmailEvent>> = {
  [INTRO_ACTIONS.accept]: INTRO_EMAIL_EVENTS.accepted,
  [INTRO_ACTIONS.decline]: INTRO_EMAIL_EVENTS.declined,
};

function readTransitionPatch(body: IntroTransitionBody, now: Date) {
  const { nextState } = INTRO_ACTION_RULES[body.action];
  const patches: Record<IntroAction, Partial<typeof introRequest.$inferInsert>> = {
    [INTRO_ACTIONS.accept]: { acceptedAt: now, expiresAt: readIntroDeadline(now), requesterHasUpdate: true },
    [INTRO_ACTIONS.decline]: {
      closedAt: now,
      requesterHasUpdate: true,
      declineReason: body.action === INTRO_ACTIONS.decline ? body.reason : null,
    },
    [INTRO_ACTIONS.withdraw]: { closedAt: now },
    [INTRO_ACTIONS.complete]: { closedAt: now, requesterHasUpdate: true },
  };
  return { state: nextState, ...patches[body.action] };
}

export async function transitionIntro(context: NetworkContext, body: IntroTransitionBody) {
  const { database, member } = context;
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.respond);

  const intro = await readRequiredIntro(context, body.introId);
  const { nextState, actor } = INTRO_ACTION_RULES[body.action];
  if (intro.viewerRole !== actor) throw introGoneError();

  const now = new Date();
  const isRequesterActing = actor === INTRO_ROLES.requester;
  const actorColumn = isRequesterActing ? introRequest.requesterId : introRequest.introducerId;
  const [applied] = await database
    .update(introRequest)
    .set(readTransitionPatch(body, now))
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

  const current = await readRequiredIntro(context, body.introId);
  if (applied) {
    const emailEvent = ACTION_EMAILS[body.action];
    if (emailEvent) sendIntroEmail(context, current, emailEvent);
    return current;
  }
  if (current.state === nextState) return current;
  throw new NetworkRequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.changed, INTRO_CHANGED_MESSAGE);
}
