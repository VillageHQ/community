import "server-only";

import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, asc, count, desc, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";

import { account, session, user, verification } from "../../database/auth-schema.ts";
import type { Database, DatabaseOrTransaction, Transaction } from "../../database/client.ts";
import { memberRemoval } from "../../database/admin-schema.ts";
import { invite, memberProfile } from "../../database/members-schema.ts";
import { memberNetwork, memberPathResult } from "../../database/village-schema.ts";
import { resolveAppUrl } from "../app-url.ts";
import { readBranding } from "../branding/branding.ts";
import { ROUTES } from "../routes.ts";
import { AUDIT_ACTIONS, type AuditAction } from "../admin/admin-api.ts";
import { withAdminTransaction } from "../admin/admin-transaction.ts";
import { recordAdminAction } from "../admin/audit.ts";
import { withAdminRosterLock } from "../admin/member-roster.ts";
import { isActiveMember, isBanActive } from "../members/active-member.ts";
import { secretsMatch } from "../secrets-match.ts";
import { DEPARTURE_SENTENCES, leaveGroupOnBehalf } from "../village/group-departure.ts";
import { isAdminMember, NetworkRequestError, staleGroupAfterLinkClears, type NetworkContext } from "../village/member-network.ts";
import { INVITE_ERROR_CODES, INVITE_FILTERS, type InviteFilter, type InviteSummary } from "./invite-api.ts";
import { toConfirmationIdentifier } from "./email-confirmation.ts";
import { deliverInviteEmail } from "./invite-email.ts";
import { INVITE_STATES, isReclaimedEmail, parseInviteEmailStatus, RECLAIMED_EMAIL_DOMAIN, readInviteExpiry, readInviteState, type InviteState } from "./invite-state.ts";
import { createInviteToken, hashInviteToken, isInviteTokenShape } from "./invite-token.ts";

const CONFLICT_STATUS = 409;
const INVITE_PAGE_SIZE = 10;
const RECLAIMED_BAN_REASON = "An admin reclaimed this invite for its real owner.";
const MEMBER_ROLE = "user";
const CREDENTIAL_PROVIDER_ID = "credential";

type InviteRow = typeof invite.$inferSelect;

const OPEN_INVITE = and(isNull(invite.acceptedAt), isNull(invite.revokedAt));

function toInviteSummary(row: InviteRow): InviteSummary {
  return {
    id: row.id,
    email: row.email,
    state: readInviteState(row),
    emailStatus: parseInviteEmailStatus(row.emailStatus),
    invitedByName: row.invitedByName,
    acceptedUserId: row.acceptedUserId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

function inviteChangedError() {
  return new NetworkRequestError(
    CONFLICT_STATUS,
    INVITE_ERROR_CODES.changed,
    "This invite changed. Reload the page and check it again.",
  );
}

async function readInviter({ database, member }: NetworkContext) {
  const [inviter] = await database.select({ name: user.name }).from(user).where(eq(user.id, member.id));
  return { id: member.id, name: inviter?.name ?? "" };
}

function recordInviteAction(transaction: Transaction, { member }: NetworkContext, action: AuditAction, email: string) {
  return recordAdminAction(transaction, member.id, { action, targetName: email });
}

function toInviteLink(environment: NetworkContext["environment"], token: string) {
  return `${resolveAppUrl(environment)}${ROUTES.join}/${token}`;
}

async function issueInvite(context: NetworkContext, row: InviteRow, token: string, message: string) {
  const { database, environment } = context;
  const link = toInviteLink(environment, token);
  const { name: communityName, accentColor } = await readBranding(database);
  const emailStatus = await deliverInviteEmail(
    { to: row.email, link, inviterName: row.invitedByName, communityName, accentColor },
    environment,
  );
  await database.update(invite).set({ emailStatus }).where(eq(invite.id, row.id));
  return { invite: toInviteSummary({ ...row, emailStatus }), link, message };
}

async function rotateInvite(connection: DatabaseOrTransaction, context: NetworkContext, inviteId: string) {
  const inviter = await readInviter(context);
  const token = createInviteToken();
  const [rotated] = await connection
    .update(invite)
    .set({
      tokenHash: hashInviteToken(token),
      expiresAt: readInviteExpiry(),
      invitedByUserId: inviter.id,
      invitedByName: inviter.name,
    })
    .where(and(eq(invite.id, inviteId), OPEN_INVITE))
    .returning();
  if (!rotated) throw inviteChangedError();
  return { rotated, token };
}

async function requireNoMemberWithEmail(connection: DatabaseOrTransaction, email: string) {
  const [existing] = await connection.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (!existing) return;
  throw new NetworkRequestError(
    CONFLICT_STATUS,
    INVITE_ERROR_CODES.alreadyMember,
    "This person already has an account. If they were removed, open them in the list above to unban them or invite them back as a new account.",
  );
}

async function renewExpiredInvite(connection: DatabaseOrTransaction, context: NetworkContext, email: string) {
  const [open] = await connection
    .select()
    .from(invite)
    .where(and(eq(invite.email, email), OPEN_INVITE));
  if (!open) throw inviteChangedError();
  if (readInviteState(open) !== INVITE_STATES.expired) {
    throw new NetworkRequestError(
      CONFLICT_STATUS,
      INVITE_ERROR_CODES.alreadyPending,
      "This person already has a pending invite. Use Resend in the list below.",
    );
  }
  return rotateInvite(connection, context, open.id);
}

export async function createInvite(context: NetworkContext, email: string) {
  const { database, member } = context;
  const inviter = await readInviter(context);
  const token = createInviteToken();
  const issued = await withAdminTransaction(database, member.id, async (transaction) => {
    await requireNoMemberWithEmail(transaction, email);
    const [created] = await transaction
      .insert(invite)
      .values({
        email,
        tokenHash: hashInviteToken(token),
        invitedByUserId: inviter.id,
        invitedByName: inviter.name,
        expiresAt: readInviteExpiry(),
      })
      .onConflictDoNothing({ target: invite.email, where: OPEN_INVITE })
      .returning();
    if (created) {
      await recordInviteAction(transaction, context, AUDIT_ACTIONS.inviteCreated, email);
      return { row: created, token, message: "Invite created." };
    }
    const { rotated, token: renewedToken } = await renewExpiredInvite(transaction, context, email);
    await recordInviteAction(transaction, context, AUDIT_ACTIONS.inviteResent, email);
    return { row: rotated, token: renewedToken, message: "Invite renewed." };
  });
  return issueInvite(context, issued.row, issued.token, issued.message);
}

export async function resendInvite(context: NetworkContext, inviteId: string) {
  const { rotated, token } = await withAdminTransaction(context.database, context.member.id, async (transaction) => {
    const result = await rotateInvite(transaction, context, inviteId);
    await recordInviteAction(transaction, context, AUDIT_ACTIONS.inviteResent, result.rotated.email);
    return result;
  });
  return issueInvite(context, rotated, token, "New link ready. The old link no longer works.");
}

export async function revokeInvite(context: NetworkContext, inviteId: string) {
  const revoked = await withAdminTransaction(context.database, context.member.id, async (transaction) => {
    const [row] = await transaction
      .update(invite)
      .set({ revokedAt: new Date() })
      .where(and(eq(invite.id, inviteId), OPEN_INVITE))
      .returning();
    if (!row) throw inviteChangedError();
    await recordInviteAction(transaction, context, AUDIT_ACTIONS.inviteRevoked, row.email);
    return row;
  });
  return toInviteSummary(revoked);
}

const INVITE_FILTER_CONDITIONS: Record<InviteFilter, (now: Date) => ReturnType<typeof and>> = {
  [INVITE_FILTERS.all]: () => undefined,
  [INVITE_FILTERS.pending]: (now) => and(OPEN_INVITE, gt(invite.expiresAt, now)),
  [INVITE_FILTERS.expired]: (now) => and(OPEN_INVITE, lte(invite.expiresAt, now)),
  [INVITE_FILTERS.accepted]: () => and(isNotNull(invite.acceptedAt), isNull(invite.revokedAt)),
  [INVITE_FILTERS.revoked]: () => isNotNull(invite.revokedAt),
};

async function countInvites(database: Database, filter: InviteFilter, now: Date) {
  const [row] = await database
    .select({ inviteCount: count() })
    .from(invite)
    .where(INVITE_FILTER_CONDITIONS[filter](now));
  return row?.inviteCount ?? 0;
}

export async function readInviteCounts(database: Database, now: Date) {
  const [all, pending, accepted, expired, revoked] = await Promise.all([
    countInvites(database, INVITE_FILTERS.all, now),
    countInvites(database, INVITE_FILTERS.pending, now),
    countInvites(database, INVITE_FILTERS.accepted, now),
    countInvites(database, INVITE_FILTERS.expired, now),
    countInvites(database, INVITE_FILTERS.revoked, now),
  ]);
  return { all, pending, accepted, expired, revoked };
}

export async function readInvites(database: Database, requestedPage: number, filter: InviteFilter = INVITE_FILTERS.all) {
  const now = new Date();
  const counts = await readInviteCounts(database, now);
  const matchCount = counts[filter];
  const pageCount = Math.max(1, Math.ceil(matchCount / INVITE_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const invites = await database
    .select()
    .from(invite)
    .where(INVITE_FILTER_CONDITIONS[filter](now))
    .orderBy(
      asc(isNotNull(invite.revokedAt)),
      asc(isNotNull(invite.acceptedAt)),
      asc(lte(invite.expiresAt, now)),
      desc(invite.createdAt),
      desc(invite.id),
    )
    .limit(INVITE_PAGE_SIZE)
    .offset((page - 1) * INVITE_PAGE_SIZE);
  return { invites: invites.map(toInviteSummary), page, pageCount, matchCount, counts };
}

export async function hasOpenOrAcceptedInvite(database: Database) {
  const [row] = await database
    .select({ inviteCount: count() })
    .from(invite)
    .where(isNull(invite.revokedAt));
  return (row?.inviteCount ?? 0) > 0;
}

export type InviteLookup = {
  id: string;
  email: string;
  state: InviteState;
  inviter: { id: string | null; name: string; title: string | null } | null;
};

export async function readInviteByToken(database: Database, token: string): Promise<InviteLookup | null> {
  if (!isInviteTokenShape(token)) return null;

  const tokenHash = hashInviteToken(token);
  const [row] = await database
    .select({
      id: invite.id,
      email: invite.email,
      tokenHash: invite.tokenHash,
      acceptedAt: invite.acceptedAt,
      revokedAt: invite.revokedAt,
      expiresAt: invite.expiresAt,
      inviterId: user.id,
      inviterName: invite.invitedByName,
      inviterTitle: memberProfile.title,
    })
    .from(invite)
    .leftJoin(user, and(eq(user.id, invite.invitedByUserId), isActiveMember()))
    .leftJoin(memberProfile, eq(memberProfile.userId, invite.invitedByUserId))
    .where(eq(invite.tokenHash, tokenHash));
  if (!row || !secretsMatch(row.tokenHash, tokenHash)) return null;

  return {
    id: row.id,
    email: row.email,
    state: readInviteState(row),
    inviter: row.inviterId ? { id: row.inviterId, name: row.inviterName, title: row.inviterTitle } : null,
  };
}

export async function readInviterOfMember(database: Database, memberId: string) {
  const [inviter] = await database
    .select({
      id: invite.invitedByUserId,
      name: invite.invitedByName,
      title: memberProfile.title,
    })
    .from(invite)
    .innerJoin(user, and(eq(user.id, invite.invitedByUserId), isActiveMember()))
    .leftJoin(memberProfile, eq(memberProfile.userId, invite.invitedByUserId))
    .where(eq(invite.acceptedUserId, memberId));
  return inviter ?? null;
}

export async function reclaimInvite(context: NetworkContext, inviteId: string) {
  const { database, member } = context;
  const inviter = await readInviter(context);
  const token = createInviteToken();
  const now = new Date();

  const replacement = await withAdminRosterLock(database, member.id, async (transaction) => {
    const [claimed] = await transaction
      .update(invite)
      .set({ revokedAt: now })
      .where(and(eq(invite.id, inviteId), isNotNull(invite.acceptedAt), isNull(invite.revokedAt)))
      .returning({ email: invite.email, claimedUserId: invite.acceptedUserId });
    if (!claimed?.claimedUserId) throw inviteChangedError();
    const { email, claimedUserId } = claimed;

    const [claimant] = await transaction
      .select({ id: user.id, name: user.name, email: user.email, role: user.role })
      .from(user)
      .where(eq(user.id, claimedUserId))
      .for("update");
    if (!claimant || isAdminMember(claimant)) throw inviteChangedError();

    await transaction
      .update(user)
      .set({
        banned: true,
        banReason: RECLAIMED_BAN_REASON,
        emailVerified: false,
        email: `reclaimed-${claimedUserId}@${RECLAIMED_EMAIL_DOMAIN}`,
      })
      .where(eq(user.id, claimedUserId));
    await transaction.delete(session).where(eq(session.userId, claimedUserId));
    await transaction.delete(verification).where(eq(verification.identifier, toConfirmationIdentifier(claimedUserId)));
    await transaction
      .update(memberNetwork)
      .set({
        staleGroupExternalId: staleGroupAfterLinkClears(),
        linkedinSlug: null,
        linkedinConfirmedSlug: null,
        villageExternalId: randomUUID(),
        sharingConsentedAt: null,
        groupJoinedAt: null,
        villageLinkedAt: null,
        pendingVillageEmail: null,
        approvedMemberEmail: null,
        approvedVillageEmail: null,
      })
      .where(eq(memberNetwork.userId, claimedUserId));
    await transaction.delete(memberPathResult).where(eq(memberPathResult.userId, claimedUserId));
    await transaction.insert(memberRemoval).values({ userId: claimedUserId, keepsContent: false, removedByUserId: member.id }).onConflictDoNothing();

    const [created] = await transaction
      .insert(invite)
      .values({
        email,
        tokenHash: hashInviteToken(token),
        invitedByUserId: inviter.id,
        invitedByName: inviter.name,
        expiresAt: readInviteExpiry(now),
      })
      .returning();
    if (!created) throw inviteChangedError();
    await recordAdminAction(transaction, member.id, {
      action: AUDIT_ACTIONS.inviteReclaimed,
      targetMemberId: claimedUserId,
      targetName: claimant.name,
      detail: email,
    });
    return { created, claimant, email, claimedUserId };
  });

  const outcome = await leaveGroupOnBehalf(context, {
    memberId: replacement.claimedUserId,
    memberName: replacement.claimant.name,
    email: replacement.email,
  });
  const lockedMessage = "We locked that account and made a new invite.";
  const message = outcome ? `${lockedMessage} ${DEPARTURE_SENTENCES[outcome](replacement.claimant.name)}` : lockedMessage;
  return issueInvite(context, replacement.created, token, message);
}

export async function reinviteRemovedMember(context: NetworkContext, memberId: string) {
  const { database, member } = context;
  const inviter = await readInviter(context);
  const token = createInviteToken();
  const reinvited = await withAdminRosterLock(database, member.id, async (transaction) => {
    const [target] = await transaction
      .select({ id: user.id, name: user.name, email: user.email, banned: user.banned, banExpires: user.banExpires })
      .from(user)
      .where(eq(user.id, memberId))
      .for("update");
    if (!target || !isBanActive(target) || isReclaimedEmail(target.email)) {
      throw new NetworkRequestError(CONFLICT_STATUS, INVITE_ERROR_CODES.changed, "This member changed. Reload the page and check again.");
    }
    await transaction
      .update(user)
      .set({ email: `reclaimed-${target.id}@${RECLAIMED_EMAIL_DOMAIN}`, emailVerified: false })
      .where(eq(user.id, target.id));
    await transaction.delete(verification).where(eq(verification.identifier, toConfirmationIdentifier(target.id)));
    await transaction.update(memberNetwork).set({ linkedinSlug: null, linkedinConfirmedSlug: null }).where(eq(memberNetwork.userId, target.id));
    await transaction.update(invite).set({ revokedAt: new Date() }).where(and(eq(invite.email, target.email), OPEN_INVITE));
    const [created] = await transaction
      .insert(invite)
      .values({
        email: target.email,
        tokenHash: hashInviteToken(token),
        invitedByUserId: inviter.id,
        invitedByName: inviter.name,
        expiresAt: readInviteExpiry(),
      })
      .returning();
    if (!created) throw inviteChangedError();
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.memberReinvited, targetMemberId: target.id, targetName: target.name, detail: target.email });
    return { created, target };
  });
  const outcome = await leaveGroupOnBehalf(context, { memberId, memberName: reinvited.target.name, email: reinvited.target.email });
  const madeMessage = "We made a new invite. It creates a new account, and the old one can't come back.";
  const message = outcome ? `${madeMessage} ${DEPARTURE_SENTENCES[outcome](reinvited.target.name)}` : madeMessage;
  return issueInvite(context, reinvited.created, token, message);
}

class InviteEmailTakenError extends Error {}

type AcceptedAccount = { name: string; password: string };

export async function acceptInvite(database: Database, token: string, { name, password }: AcceptedAccount) {
  const tokenHash = hashInviteToken(token);
  const passwordHash = await hashPassword(password);
  const userId = randomUUID();

  try {
    return await database.transaction(async (transaction) => {
      const now = new Date();
      const [claimed] = await transaction
        .update(invite)
        .set({ acceptedAt: now })
        .where(and(eq(invite.tokenHash, tokenHash), OPEN_INVITE, gt(invite.expiresAt, now)))
        .returning({ id: invite.id, email: invite.email });
      if (!claimed) return null;

      const [created] = await transaction
        .insert(user)
        .values({ id: userId, name, email: claimed.email, emailVerified: false, role: MEMBER_ROLE })
        .onConflictDoNothing({ target: user.email })
        .returning({ id: user.id });
      if (!created) throw new InviteEmailTakenError();

      await transaction.insert(account).values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: CREDENTIAL_PROVIDER_ID,
        password: passwordHash,
      });
      await transaction.insert(memberProfile).values({ userId });
      await transaction.update(invite).set({ acceptedUserId: userId }).where(eq(invite.id, claimed.id));
      return { userId, email: claimed.email };
    });
  } catch (error) {
    if (error instanceof InviteEmailTakenError) return null;
    throw error;
  }
}
