import { and, count, eq, gt, like, sql } from "drizzle-orm";

import { user, verification } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { readBranding } from "../branding/branding.ts";
import { renderSignInLinkEmail, SIGN_IN_LINK_LIFETIME_SECONDS } from "../email/sign-in-link-email.ts";
import { EMAIL_KINDS } from "../email/kinds.ts";
import { queueEmail, readLinkEmailExpiry } from "../email/outbox.ts";
import { sendQueuedEmailNow } from "../email/outbox-sender.ts";
import { readResendConfig } from "../email/resend.ts";
import type { Environment } from "../environment.ts";
import { resolveAppUrl } from "../http/app-url.ts";
import { ROUTES } from "../http/routes.ts";
import { logError } from "../observability/route-logging.ts";
import { runAfterResponse } from "../observability/after-response.ts";
import { recordFailedAttempt } from "../rate-limit/attempt-rate-limit.ts";
import { isBanActive } from "./member-status.ts";
import { isReclaimedEmail } from "./reclaimed-email.ts";

export { SIGN_IN_LINK_LIFETIME_SECONDS };

// Better Auth's magic-link plugin keeps each link as `magic-link:<hash of the token>`.
export const SIGN_IN_LINK_IDENTIFIER_PREFIX = "magic-link:";
const MAXIMUM_LINKS_PER_EMAIL_PER_MINUTE = 2;
const MAXIMUM_LIVE_LINKS_PER_EMAIL = 5;

export function toSignInLinkUrl(environment: Environment, token: string) {
  return `${resolveAppUrl(environment)}${ROUTES.signInLink}?token=${encodeURIComponent(token)}`;
}

async function countLiveLinks(database: Database, email: string) {
  const [row] = await database
    .select({ liveCount: count() })
    .from(verification)
    .where(
      and(
        like(verification.identifier, `${SIGN_IN_LINK_IDENTIFIER_PREFIX}%`),
        gt(verification.expiresAt, new Date()),
        sql`lower(${verification.value}::jsonb ->> 'email') = ${email}`,
      ),
    );
  return row?.liveCount ?? 0;
}

// Who gets a link: an active member with a real address. Everyone else gets the same answer and no email.
async function readLinkRecipient(database: Database, email: string) {
  const [member] = await database
    .select({ id: user.id, email: user.email, banned: user.banned, banExpires: user.banExpires })
    .from(user)
    .where(eq(user.email, email));
  if (!member || isBanActive(member) || isReclaimedEmail(member.email)) return null;
  return member;
}

async function sendSignInLink(database: Database, environment: Environment, { email, token }: { email: string; token: string }) {
  const config = readResendConfig(environment);
  if (!config) return;
  const normalizedEmail = email.trim().toLowerCase();
  const recipient = await readLinkRecipient(database, normalizedEmail);
  if (!recipient) return;

  const { isLimited } = await recordFailedAttempt(database, `sign-in-link-email|${normalizedEmail}`, MAXIMUM_LINKS_PER_EMAIL_PER_MINUTE);
  if (isLimited) return;
  // The row for this link is already stored, so "more than the cap" means this one is over it.
  if ((await countLiveLinks(database, normalizedEmail)) > MAXIMUM_LIVE_LINKS_PER_EMAIL) return;

  const { name: communityName, accentColor } = await readBranding(database);
  const queuedId = await queueEmail(database, environment, {
    kind: EMAIL_KINDS.signInLink,
    to: recipient.email,
    memberId: recipient.id,
    expiresAt: readLinkEmailExpiry(SIGN_IN_LINK_LIFETIME_SECONDS),
    ...renderSignInLinkEmail({ link: toSignInLinkUrl(environment, token), communityName, accentColor }),
  });
  await sendQueuedEmailNow(database, environment, queuedId);
}

export async function sendSignInLinkSafely(database: Database, environment: Environment, request: { email: string; token: string }) {
  try {
    await sendSignInLink(database, environment, request);
  } catch (error) {
    logError("sign-in-link-email", error);
  }
}

// Queuing waits until after the response, as the password reset does, so a known and an unknown email answer
// the same, in the same time. Once queued, the outbox keeps the email until it goes out.
export function createSignInLinkSender(database: Database, environment: Environment) {
  return async ({ email, token }: { email: string; token: string }) => {
    runAfterResponse(() => sendSignInLinkSafely(database, environment, { email, token }));
  };
}
