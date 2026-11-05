import "server-only";

import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Transaction } from "../../platform/database/client.ts";
import type { RequestContext, SessionMember } from "../../platform/http/request-context.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import type { MemberRemoval } from "../../platform/modules/integration.ts";
import { logAdminAction } from "../../platform/observability/route-logging.ts";
import {
  ASK_ERROR_CODES,
  ASK_LIMITS,
  ASK_STATES,
  composeAskReportBody,
  type CloseAskBody,
  type CreateAskBody,
  type OfferHelpBody,
} from "./contract.ts";
import { hasNoBlockBetween, readOpenAskCount } from "./reads.ts";
import { canRenewAsk, readAskState } from "./rules-state.ts";
import { ask, askOffer } from "./schema.ts";

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

export async function createAsk({ database, member }: RequestContext, { title, detail, category }: CreateAskBody) {
  return database.transaction(async (transaction) => {
    await lockMemberAsks(transaction, member.id);
    await assertRoomForAnotherOpenAsk(transaction, member.id, new Date());
    const [created] = await transaction.insert(ask).values({ authorId: member.id, title, detail, category }).returning({ id: ask.id });
    if (!created) throw askGoneError();
    return created;
  });
}

async function lockAskForOffer(transaction: Transaction, askId: string, helperId: string) {
  const [target] = await transaction
    .select({ authorId: ask.authorId, title: ask.title, listedAt: ask.listedAt, closedAt: ask.closedAt })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.id, askId), isActiveMember(), hasNoBlockBetween(helperId, ask.authorId)))
    .for("share", { of: ask });
  if (!target) throw askGoneError();
  if (target.authorId === helperId) throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.ownAsk, "This is your own ask.");
  if (readAskState(target, new Date()) !== ASK_STATES.open) throw askClosedError();
  return target;
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
