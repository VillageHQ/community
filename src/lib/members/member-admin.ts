import "server-only";

import { and, count, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { user } from "../../database/auth-schema.ts";
import type { Database, Transaction } from "../../database/client.ts";
import { invite, memberAvatar } from "../../database/members-schema.ts";
import { memberNetwork } from "../../database/village-schema.ts";
import { AUDIT_ACTIONS } from "../admin/admin-api.ts";
import { withAdminTransaction } from "../admin/admin-transaction.ts";
import { recordAdminAction } from "../admin/audit.ts";
import { readResendConfig } from "../email/resend.ts";
import type { Environment } from "../environment.ts";
import { INVITE_ERROR_CODES } from "../invites/invite-api.ts";
import { readLinkedinSlug } from "../village/linkedin-slug.ts";
import { NetworkRequestError, type NetworkContext } from "../village/member-network.ts";
import { NETWORK_ERROR_CODES } from "../village/network-api.ts";
import { isActiveMember } from "./active-member.ts";
import { toAvatarUrl } from "./profile.ts";

const NOT_FOUND_STATUS = 404;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const ADMIN_ROLE = "admin";
const MAXIMUM_WAITING_MEMBERS_SHOWN = 10;

function isWaitingForConfirmation() {
  return and(
    eq(user.emailVerified, false),
    isActiveMember(),
    or(isNull(user.role), ne(user.role, ADMIN_ROLE)),
  );
}

export async function readWaitingMembers(database: Database) {
  const rows = await database
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUpdatedAt: memberAvatar.updatedAt,
      inviteId: invite.id,
    })
    .from(user)
    .leftJoin(memberAvatar, eq(memberAvatar.userId, user.id))
    .leftJoin(invite, and(eq(invite.acceptedUserId, user.id), isNull(invite.revokedAt)))
    .where(isWaitingForConfirmation())
    .orderBy(user.createdAt, user.id)
    .limit(MAXIMUM_WAITING_MEMBERS_SHOWN);
  return rows.map(({ avatarUpdatedAt, ...member }) => ({
    ...member,
    avatarUrl: toAvatarUrl(member.id, avatarUpdatedAt),
  }));
}

export async function readWaitingMemberCount(database: Database) {
  const [row] = await database.select({ waitingCount: count() }).from(user).where(isWaitingForConfirmation());
  return row?.waitingCount ?? 0;
}

export async function readConfirmationBadgeCount(database: Database, environment: Environment) {
  return readResendConfig(environment) ? 0 : readWaitingMemberCount(database);
}

export async function confirmMemberEmail({ database, member }: NetworkContext, memberId: string) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    const [confirmed] = await transaction
      .update(user)
      .set({ emailVerified: true })
      .where(and(eq(user.id, memberId), eq(user.emailVerified, false), isActiveMember()))
      .returning({ name: user.name });
    if (!confirmed) {
      throw new NetworkRequestError(CONFLICT_STATUS, INVITE_ERROR_CODES.changed, "This member changed. Reload the page and check again.");
    }
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.emailConfirmed, targetMemberId: memberId, targetName: confirmed.name });
  });
}

async function readMemberName(transaction: Transaction, memberId: string) {
  const [target] = await transaction.select({ name: user.name }).from(user).where(eq(user.id, memberId));
  return target?.name ?? null;
}

export async function confirmLinkedinClaim({ database, member }: NetworkContext, memberId: string) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    const [confirmed] = await transaction
      .update(memberNetwork)
      .set({ linkedinConfirmedSlug: sql`${memberNetwork.linkedinSlug}` })
      .where(and(eq(memberNetwork.userId, memberId), isNotNull(memberNetwork.linkedinSlug)))
      .returning({ userId: memberNetwork.userId });
    if (!confirmed) {
      throw new NetworkRequestError(NOT_FOUND_STATUS, NETWORK_ERROR_CODES.memberNotFound, "This member has no LinkedIn profile to confirm.");
    }
    await recordAdminAction(transaction, member.id, {
      action: AUDIT_ACTIONS.linkedinConfirmed,
      targetMemberId: memberId,
      targetName: await readMemberName(transaction, memberId),
    });
  });
}

export async function clearLinkedinClaim({ database, member }: NetworkContext, linkedinUrl: string) {
  const linkedinSlug = readLinkedinSlug(linkedinUrl);
  if (!linkedinSlug) {
    throw new NetworkRequestError(
      UNPROCESSABLE_STATUS,
      NETWORK_ERROR_CODES.linkedinInvalid,
      "Use a LinkedIn profile URL, like https://www.linkedin.com/in/their-name.",
    );
  }

  const [holder] = await database
    .select({ id: user.id, name: user.name })
    .from(memberNetwork)
    .innerJoin(user, eq(user.id, memberNetwork.userId))
    .where(eq(memberNetwork.linkedinSlug, linkedinSlug));
  if (!holder) {
    throw new NetworkRequestError(
      NOT_FOUND_STATUS,
      NETWORK_ERROR_CODES.memberNotFound,
      "Nobody here holds that LinkedIn profile.",
    );
  }

  await withAdminTransaction(database, member.id, async (transaction) => {
    await transaction.update(memberNetwork).set({ linkedinSlug: null, linkedinConfirmedSlug: null }).where(eq(memberNetwork.userId, holder.id));
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.linkedinCleared, targetMemberId: holder.id, targetName: holder.name });
  });
  return holder.name;
}
