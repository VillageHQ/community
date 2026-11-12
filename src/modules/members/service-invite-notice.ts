import "server-only";

import { createHmac } from "node:crypto";

import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";

import { resolveAuthSecret } from "../../platform/auth/auth-secret.ts";
import { account, session, user } from "../../platform/database/auth-schema.ts";
import type { Database, DatabaseOrTransaction, Transaction } from "../../platform/database/client.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail, type EmailBranding } from "../../platform/email/outbox.ts";
import { secretsMatch } from "../../platform/secrets/secrets-match.ts";
import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { recordOutsiderAction } from "../../platform/audit/record.ts";
import { isReclaimedEmail } from "../../platform/auth/reclaimed-email.ts";
import { renderInviteUsedEmail } from "./email-invites.ts";
import { invite } from "./schema.ts";
import { adminAuditEntry } from "../../platform/audit/schema.ts";
import { INVITE_LIFETIME_DAYS } from "./contract-invite-state.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
// As long as an invite lasts: past that, a member who joined normally can't sign themselves out from an old email.
const NOT_ME_LINK_LIFETIME_MS = INVITE_LIFETIME_DAYS * DAY_MS;

const PURPOSE = "invite-not-me";
export const NOT_ME_MEMBER_FIELD = "m";
export const NOT_ME_SIGNATURE_FIELD = "s";
export const NOT_ME_REPORTER_NAME = "The invited address";

// A forwarded invite email lets whoever holds it join AS the invited address (an invite always makes the account at
// the address it went to). Joining from the emailed link confirms that address (the owner's call, 2026-11-12), so the
// address itself hears about every such join, with a link only that mailbox gets: "It wasn't me".
async function signNotMe(connection: DatabaseOrTransaction, environment: Environment, memberId: string) {
  const secret = await resolveAuthSecret(connection, environment);
  return createHmac("sha256", secret).update(`${PURPOSE}:${memberId}`).digest("base64url");
}

export function toNotMePath(memberId: string, signature: string) {
  return `${ROUTES.join}/not-me?${NOT_ME_MEMBER_FIELD}=${encodeURIComponent(memberId)}&${NOT_ME_SIGNATURE_FIELD}=${encodeURIComponent(signature)}`;
}

type JoinedMember = { id: string; email: string; name: string };

// Queued in the join's own transaction, so it goes out once, and only if the join happened.
export async function queueInviteUsedNotice(transaction: Transaction, environment: Environment, branding: EmailBranding | null, member: JoinedMember) {
  if (!branding) return null;
  const link = `${resolveAppUrl(environment)}${toNotMePath(member.id, await signNotMe(transaction, environment, member.id))}`;
  return queueEmail(transaction, environment, {
    kind: EMAIL_KINDS.inviteUsed,
    to: member.email,
    memberId: member.id,
    ...renderInviteUsedEmail({ link, communityName: branding.name, accentColor: branding.accentColor }),
  });
}

export async function isNotMeLink(connection: DatabaseOrTransaction, environment: Environment, memberId: string, signature: string) {
  return secretsMatch(signature, await signNotMe(connection, environment, memberId));
}

// "It wasn't me": whoever joined is signed out, loses any password they set, and goes back to unconfirmed, so the
// only way back in is a sign-in link, which goes to this mailbox. They land on the admin's waiting list, flagged, where
// "Wrong person?" locks the account and sends the real owner a new invite. False when the link no longer fits.
export async function reportNotMe(database: Database, environment: Environment, memberId: string, signature: string) {
  if (!(await isNotMeLink(database, environment, memberId, signature))) return false;
  return database.transaction(async (transaction) => {
    const [joined] = await transaction
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .innerJoin(invite, and(eq(invite.acceptedUserId, user.id), isNotNull(invite.acceptedAt), isNull(invite.revokedAt)))
      .where(and(eq(user.id, memberId), gt(invite.acceptedAt, new Date(Date.now() - NOT_ME_LINK_LIFETIME_MS))))
      .for("update", { of: user });
    if (!joined || isReclaimedEmail(joined.email)) return false;
    // A second press finds it done already.
    const [reported] = await transaction
      .select({ id: adminAuditEntry.id })
      .from(adminAuditEntry)
      .where(and(eq(adminAuditEntry.targetMemberId, memberId), eq(adminAuditEntry.action, AUDIT_ACTIONS.inviteReportedNotMe)));
    if (reported) return true;
    await transaction.update(user).set({ emailVerified: false }).where(eq(user.id, memberId));
    await transaction.delete(session).where(eq(session.userId, memberId));
    await transaction.delete(account).where(eq(account.userId, memberId));
    await recordOutsiderAction(transaction, AUDIT_ACTIONS.inviteReportedNotMe, {
      actorName: NOT_ME_REPORTER_NAME,
      targetMemberId: memberId,
      targetName: joined.name,
      detail: joined.email,
    });
    return true;
  });
}
