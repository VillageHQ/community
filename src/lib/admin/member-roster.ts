import "server-only";

import { and, count, eq, sql } from "drizzle-orm";

import { memberRemoval } from "../../database/admin-schema.ts";
import { session, user } from "../../platform/database/auth-schema.ts";
import type { Database, Transaction } from "../../platform/database/client.ts";
import { memberPathResult } from "../../database/village-schema.ts";
import { deleteMemberContent } from "../../modules/feed/service.ts";
import { isReclaimedEmail } from "../../platform/auth/reclaimed-email.ts";
import { isActiveMember, isBanActive } from "../../platform/auth/member-status.ts";
import { DEPARTURE_SENTENCES, leaveGroupOnBehalf } from "../village/group-departure.ts";
import { NetworkRequestError } from "../../platform/http/request-error.ts";
import { type NetworkContext } from "../../platform/http/request-context.ts";
import { NETWORK_ERROR_CODES } from "../village/network-api.ts";
import {
  ADMIN_ERROR_CODES,
  CONTENT_CHOICES,
  isDepartureIncomplete,
  REPORT_RESOLUTIONS,
  type GroupDepartureOutcome,
  type RemoveMemberBody,
  type SetMemberRoleBody,
} from "./admin-api.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { MEMBER_ROLES } from "../../platform/auth/roles.ts";
import { requireCurrentAdmin } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { resolveOpenReportsAgainstMember } from "./report-resolution.ts";

const ADMIN_ROSTER_LOCK_ID = 7260413;
const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const REMOVAL_BAN_REASON = "An admin removed this member.";

function memberGoneError() {
  return new NetworkRequestError(NOT_FOUND_STATUS, NETWORK_ERROR_CODES.memberNotFound, "This member isn't here anymore. Reload the page.");
}

function memberChangedError(message: string) {
  return new NetworkRequestError(CONFLICT_STATUS, ADMIN_ERROR_CODES.memberChanged, message);
}

function ownAccountError(message: string) {
  return new NetworkRequestError(CONFLICT_STATUS, ADMIN_ERROR_CODES.ownAccount, message);
}

// Every write to a role or a ban takes this lock first, so the admin count can't change between the check and the write.
export async function withAdminRosterLock<Result>(database: Database, actorId: string, work: (transaction: Transaction) => Promise<Result>) {
  return database.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(${ADMIN_ROSTER_LOCK_ID})`);
    await requireCurrentAdmin(transaction, actorId);
    return work(transaction);
  });
}

async function requireAnotherAdmin(transaction: Transaction) {
  const [admins] = await transaction
    .select({ adminCount: count() })
    .from(user)
    .where(and(eq(user.role, MEMBER_ROLES.admin), isActiveMember()));
  if ((admins?.adminCount ?? 0) > 1) return;
  throw new NetworkRequestError(CONFLICT_STATUS, ADMIN_ERROR_CODES.lastAdmin, "This community needs at least one admin.");
}

async function readTarget(transaction: Transaction, memberId: string) {
  const [target] = await transaction
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(user)
    .where(eq(user.id, memberId))
    .for("update");
  if (!target) throw memberGoneError();
  return target;
}

type RosterTarget = Awaited<ReturnType<typeof readTarget>>;

async function promote(transaction: Transaction, actorId: string, target: RosterTarget) {
  if (target.role === MEMBER_ROLES.admin) throw memberChangedError(`${target.name} is already an admin.`);
  if (!target.emailVerified) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      ADMIN_ERROR_CODES.emailNotConfirmed,
      `Confirm ${target.name}'s email before making them an admin.`,
    );
  }
  await transaction.update(user).set({ role: MEMBER_ROLES.admin }).where(eq(user.id, target.id));
  await recordAdminAction(transaction, actorId, { action: AUDIT_ACTIONS.rolePromoted, targetMemberId: target.id, targetName: target.name });
}

async function demote(transaction: Transaction, actorId: string, target: RosterTarget) {
  if (target.role !== MEMBER_ROLES.admin) throw memberChangedError(`${target.name} isn't an admin anymore.`);
  await requireAnotherAdmin(transaction);
  await transaction.update(user).set({ role: MEMBER_ROLES.member }).where(eq(user.id, target.id));
  await recordAdminAction(transaction, actorId, { action: AUDIT_ACTIONS.roleDemoted, targetMemberId: target.id, targetName: target.name });
}

const ROLE_CHANGES = { [MEMBER_ROLES.admin]: promote, [MEMBER_ROLES.member]: demote };

export async function setMemberRole({ database, member }: NetworkContext, { memberId, role }: SetMemberRoleBody) {
  if (memberId === member.id) throw ownAccountError("You can't change your own role. Ask another admin.");
  return withAdminRosterLock(database, member.id, async (transaction) => {
    const target = await readTarget(transaction, memberId);
    if (isBanActive(target)) throw memberChangedError(`${target.name} was removed. Unban them first.`);
    await ROLE_CHANGES[role](transaction, member.id, target);
    return target.name;
  });
}

function readRemovedSentence(name: string, outcome: GroupDepartureOutcome | null) {
  const removed = `${name} was removed and signed out.`;
  return outcome ? `${removed} ${DEPARTURE_SENTENCES[outcome](name)}` : removed;
}

export async function removeMember(context: NetworkContext, { memberId, contentChoice }: RemoveMemberBody) {
  const { database, member } = context;
  if (memberId === member.id) throw ownAccountError("You can't remove yourself. Ask another admin.");
  const keepsContent = contentChoice === CONTENT_CHOICES.keep;
  const removed = await withAdminRosterLock(database, member.id, async (transaction) => {
    const target = await readTarget(transaction, memberId);
    if (isBanActive(target)) throw memberChangedError(`${target.name} was already removed.`);
    if (target.role === MEMBER_ROLES.admin) await requireAnotherAdmin(transaction);

    await transaction
      .update(user)
      .set({ banned: true, banReason: REMOVAL_BAN_REASON, banExpires: null, role: MEMBER_ROLES.member })
      .where(eq(user.id, memberId));
    await transaction.delete(session).where(eq(session.userId, memberId));
    await transaction.delete(memberPathResult).where(eq(memberPathResult.userId, memberId));
    await transaction
      .insert(memberRemoval)
      .values({ userId: memberId, keepsContent, removedByUserId: member.id })
      .onConflictDoUpdate({ target: memberRemoval.userId, set: { keepsContent, removedByUserId: member.id, removedAt: new Date() } });
    if (!keepsContent) await deleteMemberContent(transaction, { id: memberId, name: target.name }, member.id);
    await resolveOpenReportsAgainstMember(transaction, memberId, member.id, REPORT_RESOLUTIONS.memberRemoved);
    await recordAdminAction(transaction, member.id, {
      action: AUDIT_ACTIONS.memberRemoved,
      targetMemberId: memberId,
      targetName: target.name,
      detail: keepsContent ? "Kept their posts and replies." : "Deleted their posts and replies.",
    });
    return { name: target.name, email: target.email };
  });
  const outcome = await leaveGroupOnBehalf(context, { memberId, memberName: removed.name, email: removed.email });
  return { message: readRemovedSentence(removed.name, outcome), isGroupLeaveIncomplete: isDepartureIncomplete(outcome) };
}

export async function retryGroupDeparture(context: NetworkContext, memberId: string) {
  const { database, member } = context;
  const target = await withAdminRosterLock(database, member.id, (transaction) => readTarget(transaction, memberId));
  if (!isBanActive(target)) throw memberChangedError(`${target.name} isn't removed. They can leave from Network themselves.`);
  if (isReclaimedEmail(target.email)) throw memberChangedError("This account's email is gone, so Village can't be asked to act for it.");
  const outcome = await leaveGroupOnBehalf(context, { memberId, memberName: target.name, email: target.email });
  return {
    message: outcome ? DEPARTURE_SENTENCES[outcome](target.name) : `${target.name} isn't in the Village group.`,
    isGroupLeaveIncomplete: isDepartureIncomplete(outcome),
  };
}

export async function unbanMember({ database, member }: NetworkContext, memberId: string) {
  return withAdminRosterLock(database, member.id, async (transaction) => {
    const target = await readTarget(transaction, memberId);
    if (!isBanActive(target)) throw memberChangedError(`${target.name} isn't removed anymore.`);
    if (isReclaimedEmail(target.email)) {
      throw new NetworkRequestError(
        CONFLICT_STATUS,
        ADMIN_ERROR_CODES.accountReclaimed,
        "This account's email is gone, so it can't come back. Invite the person again instead.",
      );
    }
    await transaction.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, memberId));
    await transaction.delete(memberRemoval).where(eq(memberRemoval.userId, memberId));
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.memberUnbanned, targetMemberId: memberId, targetName: target.name });
    return target.name;
  });
}
