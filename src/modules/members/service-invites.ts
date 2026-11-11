import "server-only";

import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, asc, count, desc, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";

import { account, user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction, Transaction } from "../../platform/database/client.ts";
import { invite, memberProfile } from "./schema.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { AUDIT_ACTIONS, type AuditAction } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { secretsMatch } from "../../platform/secrets/secrets-match.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { type RequestContext } from "../../platform/http/request-context.ts";
import { INVITE_ERROR_CODES, INVITE_FILTERS, type InviteFilter, type InviteSummary } from "./contract-invites.ts";
import { renderInviteEmail } from "./email-invites.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { cancelQueuedEmail, OUTBOX_STATUSES, queueEmail, readEmailBranding, type EmailBranding } from "../../platform/email/outbox.ts";
import { emailOutbox } from "../../platform/email/schema.ts";
import { sendQueuedEmailNow } from "../../platform/email/outbox-sender.ts";
import {
  INVITE_EMAIL_STATUSES,
  INVITE_STATES,
  parseInviteEmailStatus,
  readInviteExpiry,
  readInviteState,
  type InviteState,
} from "./contract-invite-state.ts";
import { createInviteToken, hashInviteToken, isInviteTokenShape } from "./service-invite-token.ts";

const CONFLICT_STATUS = 409;
const INVITE_PAGE_SIZE = 10;
const MEMBER_ROLE = "user";
const CREDENTIAL_PROVIDER_ID = "credential";

type InviteRow = typeof invite.$inferSelect;

export const OPEN_INVITE = and(isNull(invite.acceptedAt), isNull(invite.revokedAt));

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

export function inviteChangedError() {
  return new RequestError(
    CONFLICT_STATUS,
    INVITE_ERROR_CODES.changed,
    "This invite changed. Reload the page and check it again.",
  );
}

export async function readInviter({ database, member }: RequestContext) {
  const [inviter] = await database.select({ name: user.name }).from(user).where(eq(user.id, member.id));
  return { id: member.id, name: inviter?.name ?? "" };
}

function recordInviteAction(transaction: Transaction, { member }: RequestContext, action: AuditAction, email: string) {
  return recordAdminAction(transaction, member.id, { action, targetName: email });
}

export function toInviteLink(environment: RequestContext["environment"], token: string) {
  return `${resolveAppUrl(environment)}${ROUTES.join}/${token}`;
}

// The inviter's role on their card: it signs the invite ("Maya Ortiz, Head of Platform, Northwind Founders").
async function readInviterRole(connection: DatabaseOrTransaction, inviterId: string) {
  const [profile] = await connection.select({ title: memberProfile.title }).from(memberProfile).where(eq(memberProfile.userId, inviterId));
  return profile?.title?.trim() || null;
}

// Call inside the transaction that creates or renews the invite, so the email can't be lost.
// Takes the branding read before the transaction (readEmailBranding); null means email is off.
// A renewed invite's older email still waiting in the queue carries a dead link, so it is stopped.
export async function queueInviteEmail(transaction: Transaction, { environment }: RequestContext, branding: EmailBranding | null, row: InviteRow, token: string) {
  await cancelQueuedEmail(transaction, row.emailOutboxId);
  const link = toInviteLink(environment, token);
  const inviterRole = branding && row.invitedByUserId ? await readInviterRole(transaction, row.invitedByUserId) : null;
  const queuedId = branding
    ? await queueEmail(transaction, environment, {
        kind: EMAIL_KINDS.invite,
        to: row.email,
        memberId: null,
        ...renderInviteEmail({
          link,
          inviterName: row.invitedByName,
          inviterRole,
          inviteeName: row.inviteeName,
          communityName: branding.name,
          accentColor: branding.accentColor,
        }),
      })
    : null;
  await transaction.update(invite).set({ emailOutboxId: queuedId }).where(eq(invite.id, row.id));
  return queuedId;
}

export function cancelInviteEmail(transaction: Transaction, row: Pick<InviteRow, "emailOutboxId">) {
  return cancelQueuedEmail(transaction, row.emailOutboxId);
}

// The stored status is the first try. Once an email is queued, its outbox row tells the rest.
function readLiveEmailStatus(stored: string, outboxStatus: string | null) {
  if (outboxStatus === OUTBOX_STATUSES.sent) return INVITE_EMAIL_STATUSES.sent;
  if (outboxStatus === OUTBOX_STATUSES.failed) return INVITE_EMAIL_STATUSES.failed;
  if (outboxStatus === OUTBOX_STATUSES.pending || outboxStatus === OUTBOX_STATUSES.sending) return INVITE_EMAIL_STATUSES.retrying;
  return stored;
}

// Tries the queued email at once, so the admin sees whether it went out. A failed try stays
// queued, and the timed sender keeps trying.
export async function issueInvite(context: RequestContext, row: InviteRow, token: string, message: string, queuedEmailId: string | null) {
  const { database, environment } = context;
  const link = toInviteLink(environment, token);
  const isSent = queuedEmailId !== null && (await sendQueuedEmailNow(database, environment, queuedEmailId));
  const emailStatus = queuedEmailId === null ? INVITE_EMAIL_STATUSES.notSent : isSent ? INVITE_EMAIL_STATUSES.sent : INVITE_EMAIL_STATUSES.retrying;
  await database.update(invite).set({ emailStatus }).where(eq(invite.id, row.id));
  return { invite: toInviteSummary({ ...row, emailStatus, emailOutboxId: queuedEmailId }), link, message };
}

async function rotateInvite(connection: DatabaseOrTransaction, context: RequestContext, inviteId: string) {
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
  throw new RequestError(
    CONFLICT_STATUS,
    INVITE_ERROR_CODES.alreadyMember,
    "This person already has an account. If they were removed, open them in the list above to unban them or invite them back as a new account.",
  );
}

async function renewExpiredInvite(connection: DatabaseOrTransaction, context: RequestContext, email: string) {
  const [open] = await connection
    .select()
    .from(invite)
    .where(and(eq(invite.email, email), OPEN_INVITE));
  if (!open) throw inviteChangedError();
  if (readInviteState(open) !== INVITE_STATES.expired) {
    throw new RequestError(
      CONFLICT_STATUS,
      INVITE_ERROR_CODES.alreadyPending,
      "This person already has a pending invite. Use Resend in the list below.",
    );
  }
  return rotateInvite(connection, context, open.id);
}

export async function createInvite(context: RequestContext, email: string, cohort: string | null = null) {
  const { database, member } = context;
  const inviter = await readInviter(context);
  const token = createInviteToken();
  const branding = await readEmailBranding(database, context.environment);
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
        cohort,
      })
      .onConflictDoNothing({ target: invite.email, where: OPEN_INVITE })
      .returning();
    if (created) {
      await recordInviteAction(transaction, context, AUDIT_ACTIONS.inviteCreated, email);
      const queuedEmailId = await queueInviteEmail(transaction, context, branding, created, token);
      return { row: created, token, message: "Invite created.", queuedEmailId };
    }
    const renewal = await renewExpiredInvite(transaction, context, email);
    const { token: renewedToken } = renewal;
    // A cohort given now replaces the old one; none keeps it.
    const rotated = cohort ? ((await transaction.update(invite).set({ cohort }).where(eq(invite.id, renewal.rotated.id)).returning())[0] ?? renewal.rotated) : renewal.rotated;
    await recordInviteAction(transaction, context, AUDIT_ACTIONS.inviteResent, email);
    const queuedEmailId = await queueInviteEmail(transaction, context, branding, rotated, renewedToken);
    return { row: rotated, token: renewedToken, message: "Invite renewed.", queuedEmailId };
  });
  return issueInvite(context, issued.row, issued.token, issued.message, issued.queuedEmailId);
}

export async function resendInvite(context: RequestContext, inviteId: string) {
  const branding = await readEmailBranding(context.database, context.environment);
  const { rotated, token, queuedEmailId } = await withAdminTransaction(context.database, context.member.id, async (transaction) => {
    const result = await rotateInvite(transaction, context, inviteId);
    await recordInviteAction(transaction, context, AUDIT_ACTIONS.inviteResent, result.rotated.email);
    return { ...result, queuedEmailId: await queueInviteEmail(transaction, context, branding, result.rotated, result.token) };
  });
  return issueInvite(context, rotated, token, "New link ready. The old link no longer works.", queuedEmailId);
}

export async function revokeInvite(context: RequestContext, inviteId: string) {
  const revoked = await withAdminTransaction(context.database, context.member.id, async (transaction) => {
    const [row] = await transaction
      .update(invite)
      .set({ revokedAt: new Date() })
      .where(and(eq(invite.id, inviteId), OPEN_INVITE))
      .returning();
    if (!row) throw inviteChangedError();
    await cancelInviteEmail(transaction, row);
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
    .select({ row: invite, outboxStatus: emailOutbox.status })
    .from(invite)
    .leftJoin(emailOutbox, eq(emailOutbox.id, invite.emailOutboxId))
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
  return {
    invites: invites.map(({ row, outboxStatus }) => toInviteSummary({ ...row, emailStatus: readLiveEmailStatus(row.emailStatus, outboxStatus) })),
    page,
    pageCount,
    matchCount,
    counts,
  };
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
  inviteeName: string | null;
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
      inviteeName: invite.inviteeName,
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
    inviteeName: row.inviteeName,
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
        .returning({ id: invite.id, email: invite.email, company: invite.company, cohort: invite.cohort, emailOutboxId: invite.emailOutboxId });
      if (!claimed) return null;
      // Accepted from the copied link: a still-queued invite email would only carry a used link.
      await cancelInviteEmail(transaction, claimed);

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
      await transaction.insert(memberProfile).values({ userId, company: claimed.company, cohort: claimed.cohort });
      await transaction.update(invite).set({ acceptedUserId: userId }).where(eq(invite.id, claimed.id));
      return { userId, email: claimed.email };
    });
  } catch (error) {
    if (error instanceof InviteEmailTakenError) return null;
    throw error;
  }
}
