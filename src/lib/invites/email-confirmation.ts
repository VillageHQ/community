import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { user, verification } from "../../platform/database/auth-schema.ts";
import type { Database } from "../../platform/database/client.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { readBranding } from "../../platform/branding/branding.ts";
import { readResendConfig, sendResendEmail } from "../../platform/email/resend.ts";
import type { Environment } from "../../platform/environment.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { secretsMatch } from "../../platform/secrets/secrets-match.ts";
import { NetworkRequestError, type NetworkContext } from "../village/member-network.ts";
import { INVITE_ERROR_CODES } from "./invite-api.ts";
import { CONFIRMATION_VIEWS, type ConfirmationView } from "./email-confirmation-views.ts";
import { renderConfirmationEmail } from "./invite-email.ts";
import { createInviteToken, hashInviteToken, isInviteTokenShape } from "./invite-token.ts";

const CONFIRMATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const CONFIRMATION_IDENTIFIER_PREFIX = "email-confirmation";
const IDEMPOTENCY_TOKEN_PREFIX_LENGTH = 16;
const FORBIDDEN_STATUS = 403;
const GONE_STATUS = 410;

type ConfirmedAccount = { id: string; name: string; email: string };

export function toConfirmationIdentifier(memberId: string) {
  return `${CONFIRMATION_IDENTIFIER_PREFIX}:${memberId}`;
}

async function issueConfirmationToken(database: Database, memberId: string) {
  const token = createInviteToken();
  await database.insert(verification).values({
    id: randomUUID(),
    identifier: toConfirmationIdentifier(memberId),
    value: hashInviteToken(token),
    expiresAt: new Date(Date.now() + CONFIRMATION_LIFETIME_MS),
  });
  return token;
}

export async function sendEmailConfirmation(database: Database, environment: Environment, account: ConfirmedAccount) {
  const config = readResendConfig(environment);
  if (!config) return false;

  try {
    const token = await issueConfirmationToken(database, account.id);
    const link = `${resolveAppUrl(environment)}${ROUTES.confirmEmail}?token=${token}`;
    const { name: communityName, accentColor } = await readBranding(database);
    await sendResendEmail(config, {
      to: account.email,
      idempotencyKey: `confirm-${token.slice(0, IDEMPOTENCY_TOKEN_PREFIX_LENGTH)}`,
      ...renderConfirmationEmail({ link, memberName: account.name, communityName, accentColor }),
    });
    return true;
  } catch (error) {
    logError("email-confirmation", error);
    return false;
  }
}

async function readLiveConfirmation(database: Database, token: string) {
  if (!isInviteTokenShape(token)) return null;
  const tokenHash = hashInviteToken(token);
  const [row] = await database
    .select({ identifier: verification.identifier, value: verification.value })
    .from(verification)
    .where(and(eq(verification.value, tokenHash), gt(verification.expiresAt, new Date())));
  if (!row || !secretsMatch(row.value, tokenHash)) return null;
  return row;
}

export async function readConfirmationView(
  database: Database,
  token: string,
  viewer: { id: string } | null,
): Promise<ConfirmationView> {
  if (!viewer) return CONFIRMATION_VIEWS.signIn;

  const confirmation = await readLiveConfirmation(database, token);
  if (!confirmation) return CONFIRMATION_VIEWS.invalid;
  return confirmation.identifier === toConfirmationIdentifier(viewer.id)
    ? CONFIRMATION_VIEWS.confirm
    : CONFIRMATION_VIEWS.wrongAccount;
}

export async function confirmEmailWithToken({ database, member }: NetworkContext, token: string) {
  const confirmation = await readLiveConfirmation(database, token);
  if (!confirmation) {
    throw new NetworkRequestError(
      GONE_STATUS,
      INVITE_ERROR_CODES.unusable,
      "This link didn't work. It may have expired or been used already.",
    );
  }
  const identifier = toConfirmationIdentifier(member.id);
  if (confirmation.identifier !== identifier) {
    throw new NetworkRequestError(
      FORBIDDEN_STATUS,
      INVITE_ERROR_CODES.changed,
      "This link belongs to another account. Sign in to that account to use it.",
    );
  }

  await database.transaction(async (transaction) => {
    const consumed = await transaction
      .delete(verification)
      .where(and(eq(verification.identifier, identifier), eq(verification.value, confirmation.value)))
      .returning({ id: verification.id });
    if (consumed.length === 0) {
      throw new NetworkRequestError(GONE_STATUS, INVITE_ERROR_CODES.unusable, "This link has been used already.");
    }
    await transaction.update(user).set({ emailVerified: true }).where(eq(user.id, member.id));
    await transaction.delete(verification).where(eq(verification.identifier, identifier));
  });
}
