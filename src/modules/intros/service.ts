import "server-only";

import { and, eq, gt, inArray } from "drizzle-orm";

import { introRequest } from "./schema.ts";
import { memberBlock } from "../members/schema.ts";
import { readEmailBranding } from "../../platform/email/outbox.ts";
import { sendQueuedEmailsSoon } from "../../platform/email/outbox-sender.ts";
import { readAskableConnectors } from "../network/service.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { type RequestContext } from "../../platform/http/request-context.ts";
import {
  INTRO_ACTION_RULES,
  INTRO_ACTIONS,
  INTRO_ERROR_CODES,
  INTRO_ROLES,
  readStatesLeadingTo,
  type CreateIntroBody,
  type IntroAction,
  type IntroTransitionBody,
} from "./contract.ts";
import { INTRO_EMAIL_EVENTS, queueIntroEmail, type IntroEmailEvent } from "./email.ts";
import { enforceIntroLimit, INTRO_LIMIT_KINDS } from "./limits.ts";
import { expireDueIntros, hasBothParticipantsJoined, readIntroDeadline, readIntroForViewer } from "./reads.ts";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const INTRO_CHANGED_MESSAGE = "This ask just changed. Here's where it stands now.";

export function introGoneError() {
  return new RequestError(NOT_FOUND_STATUS, INTRO_ERROR_CODES.notFound, "This ask isn't available.");
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
      "This person can't take this ask through the community. Look up who can intro you again.",
    );
  }
  if (!askable.targetName) {
    throw new RequestError(
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
  const isWithheld = await isBlockedBy(context, asked.introducerId, member.id);

  await expireDueIntros(database, member.id);
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
        expiresAt: readIntroDeadline(),
      })
      .onConflictDoNothing()
      .returning({ id: introRequest.id });
    if (inserted) await queueIntroEmail(transaction, context.environment, branding, inserted.id, INTRO_EMAIL_EVENTS.asked);
    return inserted;
  });
  if (!created) {
    throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.duplicate, "You already have an open ask with this person for this intro.");
  }

  sendQueuedEmailsSoon(database, context.environment);
  return readRequiredIntro(context, created.id);
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

export async function transitionIntro(context: RequestContext, body: IntroTransitionBody) {
  const { database, member } = context;
  await enforceIntroLimit(database, member.id, INTRO_LIMIT_KINDS.respond);

  const intro = await readRequiredIntro(context, body.introId);
  const { nextState, actor } = INTRO_ACTION_RULES[body.action];
  if (intro.viewerRole !== actor) throw introGoneError();

  const now = new Date();
  const isRequesterActing = actor === INTRO_ROLES.requester;
  const actorColumn = isRequesterActing ? introRequest.requesterId : introRequest.introducerId;
  const emailEvent = ACTION_EMAILS[body.action];
  const branding = emailEvent ? await readEmailBranding(database, context.environment) : null;
  const applied = await database.transaction(async (transaction) => {
    const [updated] = await transaction
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
    if (updated && emailEvent) await queueIntroEmail(transaction, context.environment, branding, updated.id, emailEvent);
    return updated;
  });

  const current = await readRequiredIntro(context, body.introId);
  if (applied) {
    if (emailEvent) sendQueuedEmailsSoon(database, context.environment);
    return current;
  }
  if (current.state === nextState) return current;
  throw new RequestError(CONFLICT_STATUS, INTRO_ERROR_CODES.changed, INTRO_CHANGED_MESSAGE);
}
