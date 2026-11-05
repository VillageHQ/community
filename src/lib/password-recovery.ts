import { randomUUID } from "node:crypto";

import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { account, session, user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { AUDIT_ACTIONS, MEMBER_ROLES } from "./admin/admin-api.ts";
import { recordAdminAction } from "./admin/audit.ts";
import { resolveAppUrl } from "./app-url.ts";
import { readBranding } from "./branding/branding.ts";
import { recordFailedAttempt } from "./attempt-rate-limit.ts";
import { PASSWORD_RESET_LIFETIME_SECONDS, renderPasswordResetEmail } from "./email/password-reset-email.ts";
import { readResendConfig, sendResendEmail } from "./email/resend.ts";
import type { Environment } from "./environment.ts";
import { isReclaimedEmail } from "./invites/invite-state.ts";
import { isActiveMember, isBanActive } from "./members/active-member.ts";
import { logError } from "./route-logging.ts";
import { ROUTES } from "./routes.ts";

const CREDENTIAL_PROVIDER_ID = "credential";
const IDEMPOTENCY_TOKEN_PREFIX_LENGTH = 16;
const MAXIMUM_RESET_EMAILS_PER_MINUTE = 3;

export { PASSWORD_RESET_LIFETIME_SECONDS };

type ResetRequest = { memberId: string; token: string };

async function sendResetEmail(database: Database, environment: Environment, { memberId, token }: ResetRequest) {
  const config = readResendConfig(environment);
  if (!config) return;
  const [member] = await database
    .select({ email: user.email, banned: user.banned, banExpires: user.banExpires })
    .from(user)
    .where(eq(user.id, memberId));
  if (!member || isBanActive(member) || isReclaimedEmail(member.email)) return;

  const { isLimited } = await recordFailedAttempt(database, `password-reset-email|${memberId}`, MAXIMUM_RESET_EMAILS_PER_MINUTE);
  if (isLimited) return;

  const { name: communityName, accentColor } = await readBranding(database);
  const link = `${resolveAppUrl(environment)}${ROUTES.resetPassword}?token=${encodeURIComponent(token)}`;
  await sendResendEmail(config, {
    to: member.email,
    idempotencyKey: `password-reset-${token.slice(0, IDEMPOTENCY_TOKEN_PREFIX_LENGTH)}`,
    ...renderPasswordResetEmail({ link, communityName, accentColor }),
  });
}

export async function sendResetEmailSafely(database: Database, environment: Environment, request: ResetRequest) {
  try {
    await sendResetEmail(database, environment, request);
  } catch (error) {
    logError("password-reset-email", error);
  }
}

export async function recordPasswordReset(database: Database, memberId: string, memberName: string) {
  try {
    await recordAdminAction(database, memberId, { action: AUDIT_ACTIONS.passwordReset, targetMemberId: memberId, targetName: memberName });
  } catch (error) {
    logError("password-reset-audit", error);
  }
}

type AdminRecovery = { email: string; newPassword: string };

export async function recoverAdminPassword(database: Database, { email, newPassword }: AdminRecovery) {
  const passwordHash = await hashPassword(newPassword);
  return database.transaction(async (transaction) => {
    const [admin] = await transaction
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(and(eq(user.email, email.trim().toLowerCase()), eq(user.role, MEMBER_ROLES.admin), isActiveMember()))
      .for("update");
    if (!admin) return false;

    const updated = await transaction
      .update(account)
      .set({ password: passwordHash })
      .where(and(eq(account.userId, admin.id), eq(account.providerId, CREDENTIAL_PROVIDER_ID)))
      .returning({ id: account.id });
    if (updated.length === 0) {
      await transaction.insert(account).values({
        id: randomUUID(),
        userId: admin.id,
        accountId: admin.id,
        providerId: CREDENTIAL_PROVIDER_ID,
        password: passwordHash,
      });
    }
    await transaction.delete(session).where(eq(session.userId, admin.id));
    await recordAdminAction(transaction, admin.id, { action: AUDIT_ACTIONS.adminPasswordRecovered, targetMemberId: admin.id, targetName: admin.name });
    return true;
  });
}
