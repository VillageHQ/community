import "server-only";

import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { DatabaseOrTransaction, Transaction } from "../../platform/database/client.ts";
import type { RequestContext, SessionMember } from "../../platform/http/request-context.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import type { MemberRemoval } from "../../platform/modules/integration.ts";
import { logAdminAction } from "../../platform/observability/route-logging.ts";
import { saveSettings } from "../../platform/settings/store.ts";
import {
  ASK_ALLOWANCE_SETTING,
  ASK_ERROR_CODES,
  ASK_KINDS,
  ASK_LIMITS,
  ASK_STATES,
  composeAnswerReportBody,
  composeAskReportBody,
  type AnswerAskBody,
  type CloseAskBody,
  type CreateAskBody,
  type OfferHelpBody,
} from "./contract.ts";
import { hasNoBlockBetween, readOpenAskCount } from "./reads.ts";
import { canRenewAsk, readAskState } from "./rules-state.ts";
import { ask, askAnswer, askHelper, askOffer } from "./schema.ts";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;

function askGoneError() {
  return new RequestError(NOT_FOUND_STATUS, ASK_ERROR_CODES.notFound, "This ask isn't available anymore.");
}

function openLimitError() {
  return new RequestError(CONFLICT_STATUS, ASK_ERROR_CODES.openLimit, `You already have ${ASK_LIMITS.openPerMember} open asks. Close one, then post this.`);
}

function askClosedError() {
  return new RequestError(CONFLICT_STATUS, ASK_ERROR_CODES.closed, "This ask just closed, so it doesn't need offers anymore.");
}

// The lock makes two posts at once count each other, so a member can't slip past the open limit. It leaves foreign keys free.
async function lockMemberAsks(transaction: Transaction, memberId: string) {
  await transaction.select({ id: user.id }).from(user).where(eq(user.id, memberId)).for("no key update");
}

async function assertRoomForAnotherOpenAsk(transaction: Transaction, memberId: string, now: Date) {
  if ((await readOpenAskCount(transaction, memberId, now)) >= ASK_LIMITS.openPerMember) throw openLimitError();
}

// Checks the weekly allowance inside the posting transaction, after the member row lock. It lives in the shell,
// because intro asks share it and this module can't read intros.
export type AllowanceCheck = (transaction: Transaction, memberId: string) => Promise<void>;

export async function createAsk({ database, member }: RequestContext, body: CreateAskBody, assertAllowance: AllowanceCheck) {
  const { title, detail, category, kind } = body;
  const isAsk = kind === ASK_KINDS.ask;
  return database.transaction(async (transaction) => {
    await lockMemberAsks(transaction, member.id);
    await assertRoomForAnotherOpenAsk(transaction, member.id, new Date());
    if (isAsk) await assertAllowance(transaction, member.id);
    const [created] = await transaction
      .insert(ask)
      .values({ authorId: member.id, title, detail, category, kind, targetSlug: isAsk ? body.targetLinkedin : null })
      .returning({ id: ask.id });
    if (!created) throw askGoneError();
    return created;
  });
}

async function lockAskForOffer(transaction: Transaction, askId: string, helperId: string) {
  const [target] = await transaction
    .select({ authorId: ask.authorId, title: ask.title, kind: ask.kind, listedAt: ask.listedAt, closedAt: ask.closedAt })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.id, askId), isActiveMember(), hasNoBlockBetween(helperId, ask.authorId)))
    .for("share", { of: ask });
  if (!target) throw askGoneError();
  if (target.authorId === helperId) throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.ownAsk, "This is your own ask.");
  if (target.kind !== ASK_KINDS.ask) throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.notAnAsk, "This is an update, so it doesn't need help.");
  if (readAskState(target, new Date()) !== ASK_STATES.open) throw askClosedError();
  return target;
}

// "I've done this myself": one public answer per member under an open ask. A second try finds the first.
export async function answerAsk({ database, member }: RequestContext, { askId, body }: AnswerAskBody) {
  return database.transaction(async (transaction) => {
    await lockAskForOffer(transaction, askId, member.id);
    const [created] = await transaction.insert(askAnswer).values({ askId, authorId: member.id, body }).onConflictDoNothing().returning({ id: askAnswer.id });
    if (created) return { id: created.id, wasAlreadyAnswered: false };
    const [earlier] = await transaction
      .select({ id: askAnswer.id })
      .from(askAnswer)
      .where(and(eq(askAnswer.askId, askId), eq(askAnswer.authorId, member.id)));
    if (!earlier) throw askGoneError();
    return { id: earlier.id, wasAlreadyAnswered: true };
  });
}

// The ask a helper is acting on, as that helper may see it: open, an ask, not their own, no block either way.
export async function readAskForHelper(connection: DatabaseOrTransaction, askId: string, helperId: string) {
  const [target] = await connection
    .select({
      authorId: ask.authorId,
      title: ask.title,
      kind: ask.kind,
      targetSlug: ask.targetSlug,
      targetName: ask.targetName,
      listedAt: ask.listedAt,
      closedAt: ask.closedAt,
    })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.id, askId), isActiveMember(), hasNoBlockBetween(helperId, ask.authorId)));
  if (!target) throw askGoneError();
  if (target.authorId === helperId) throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.ownAsk, "This is your own ask.");
  if (target.kind !== ASK_KINDS.ask) throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.notAnAsk, "This is an update, so it doesn't need help.");
  if (readAskState(target, new Date()) !== ASK_STATES.open) throw askClosedError();
  return target;
}

// A path helper on the author's own open ask, so the author can ask them for the intro.
export async function readPathHelperForAuthor(connection: DatabaseOrTransaction, authorId: string, askId: string, helperId: string) {
  const [target] = await connection
    .select({ targetSlug: ask.targetSlug, connectorSlug: askHelper.connectorSlug, listedAt: ask.listedAt, closedAt: ask.closedAt })
    .from(askHelper)
    .innerJoin(ask, eq(ask.id, askHelper.askId))
    .innerJoin(user, eq(user.id, askHelper.helperId))
    .where(and(eq(askHelper.askId, askId), eq(askHelper.helperId, helperId), eq(ask.authorId, authorId), isActiveMember(), hasNoBlockBetween(authorId, askHelper.helperId)));
  if (!target?.targetSlug || !target.connectorSlug) {
    throw new RequestError(NOT_FOUND_STATUS, ASK_ERROR_CODES.notHelper, "This member isn't on a path to the person you named. Message them instead.");
  }
  if (readAskState(target, new Date()) !== ASK_STATES.open) throw askClosedError();
  return { targetSlug: target.targetSlug, connectorSlug: target.connectorSlug };
}

export type DeliverableOffer = { id: string; askerId: string; askTitle: string; note: string };
export type OfferDelivery = (context: RequestContext, offer: DeliverableOffer) => Promise<boolean>;

// The note is saved first, so the asker has it whether or not delivery works. `deliver` comes from the route, because this module can't know about messages.
export async function offerHelp(context: RequestContext, { askId, note }: OfferHelpBody, deliver: OfferDelivery) {
  const { database, member } = context;
  const offer = await database.transaction(async (transaction) => {
    const { authorId, title } = await lockAskForOffer(transaction, askId, member.id);
    const [created] = await transaction.insert(askOffer).values({ askId, helperId: member.id, note }).onConflictDoNothing().returning({ id: askOffer.id });
    return created ? { id: created.id, askerId: authorId, askTitle: title, note } : null;
  });
  if (!offer) return { isSentAsMessage: false, wasAlreadyOffered: true };
  return { isSentAsMessage: await deliver(context, offer), wasAlreadyOffered: false };
}

async function lockOwnAsk(transaction: Transaction, askId: string, ownerId: string) {
  const [target] = await transaction
    .select({ listedAt: ask.listedAt, closedAt: ask.closedAt })
    .from(ask)
    .where(and(eq(ask.id, askId), eq(ask.authorId, ownerId)))
    .for("update");
  if (!target) throw askGoneError();
  return target;
}

export async function closeAsk({ database, member }: RequestContext, { askId, outcome }: CloseAskBody) {
  await database.transaction(async (transaction) => {
    const { closedAt } = await lockOwnAsk(transaction, askId, member.id);
    if (closedAt) throw new RequestError(CONFLICT_STATUS, ASK_ERROR_CODES.closed, "You already closed this ask.");
    await transaction.update(ask).set({ closedAt: new Date(), outcome }).where(eq(ask.id, askId));
  });
}

export async function renewAsk({ database, member }: RequestContext, askId: string) {
  await database.transaction(async (transaction) => {
    await lockMemberAsks(transaction, member.id);
    const target = await lockOwnAsk(transaction, askId, member.id);
    const now = new Date();
    if (target.closedAt) throw new RequestError(CONFLICT_STATUS, ASK_ERROR_CODES.closed, "This ask is closed. Post a new one if you still need help.");
    if (!canRenewAsk(target, now)) {
      throw new RequestError(CONFLICT_STATUS, ASK_ERROR_CODES.tooEarlyToRenew, `You can renew an ask in its last ${ASK_LIMITS.renewableWithinDays} days.`);
    }
    if (readAskState(target, now) === ASK_STATES.expired) await assertRoomForAnotherOpenAsk(transaction, member.id, now);
    await transaction.update(ask).set({ listedAt: now }).where(eq(ask.id, askId));
  });
}

export async function markOffersSeen({ database, member }: RequestContext) {
  const ownAskIds = database.select({ id: ask.id }).from(ask).where(eq(ask.authorId, member.id));
  await database
    .update(askOffer)
    .set({ seenAt: new Date() })
    .where(and(isNull(askOffer.seenAt), inArray(askOffer.askId, ownAskIds)));
}

export async function removeAskWithin(transaction: Transaction, admin: SessionMember, askId: string) {
  const [target] = await transaction
    .select({ authorId: ask.authorId, authorName: user.name, title: ask.title, detail: ask.detail })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(eq(ask.id, askId))
    .for("update", { of: ask });
  if (!target) throw askGoneError();
  await transaction.delete(ask).where(eq(ask.id, askId));
  await recordAdminAction(transaction, admin.id, {
    action: AUDIT_ACTIONS.askRemoved,
    targetMemberId: target.authorId,
    targetName: target.authorName,
    detail: composeAskReportBody(target.title, target.detail),
  });
}

export async function removeAnswerWithin(transaction: Transaction, admin: SessionMember, answerId: string) {
  const [target] = await transaction
    .select({ authorId: askAnswer.authorId, authorName: user.name, body: askAnswer.body, askTitle: ask.title })
    .from(askAnswer)
    .innerJoin(ask, eq(ask.id, askAnswer.askId))
    .innerJoin(user, eq(user.id, askAnswer.authorId))
    .where(eq(askAnswer.id, answerId))
    .for("update", { of: askAnswer });
  if (!target) throw new RequestError(NOT_FOUND_STATUS, ASK_ERROR_CODES.answerNotFound, "This answer isn't there anymore.");
  await transaction.delete(askAnswer).where(eq(askAnswer.id, answerId));
  await recordAdminAction(transaction, admin.id, {
    action: AUDIT_ACTIONS.askAnswerRemoved,
    targetMemberId: target.authorId,
    targetName: target.authorName,
    detail: composeAnswerReportBody(target.askTitle, target.body),
  });
}

export async function removeAsk({ database, member }: RequestContext, askId: string) {
  await withAdminTransaction(database, member.id, (transaction) => removeAskWithin(transaction, member, askId));
  logAdminAction("ask_removed", member.id, askId);
}

export async function deleteMemberAsks(transaction: Transaction, { memberId, memberName, actorId }: MemberRemoval) {
  const asks = await transaction.select({ title: ask.title, detail: ask.detail }).from(ask).where(eq(ask.authorId, memberId));
  for (const { title, detail } of asks) {
    await recordAdminAction(transaction, actorId, {
      action: AUDIT_ACTIONS.askRemoved,
      targetMemberId: memberId,
      targetName: memberName,
      detail: composeAskReportBody(title, detail),
    });
  }
  await transaction.delete(ask).where(eq(ask.authorId, memberId));
  await transaction.delete(askOffer).where(eq(askOffer.helperId, memberId));
  await transaction.delete(askAnswer).where(eq(askAnswer.authorId, memberId));
  await transaction.delete(askHelper).where(eq(askHelper.helperId, memberId));
}

// Hiding alone would bring these notes back after an unblock, and messages stay hidden after one.
export async function withdrawOffersBetween(transaction: Transaction, blockerId: string, blockedId: string) {
  const asksBy = (authorId: string) => transaction.select({ id: ask.id }).from(ask).where(eq(ask.authorId, authorId));
  await transaction
    .delete(askOffer)
    .where(
      or(
        and(eq(askOffer.helperId, blockedId), inArray(askOffer.askId, asksBy(blockerId))),
        and(eq(askOffer.helperId, blockerId), inArray(askOffer.askId, asksBy(blockedId))),
      ),
    );
}

export async function saveWeeklyAllowance({ database, member }: RequestContext, weeklyAllowance: number) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    await saveSettings(transaction, { [ASK_ALLOWANCE_SETTING]: String(weeklyAllowance) });
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.askAllowanceChanged, detail: String(weeklyAllowance) });
  });
}
