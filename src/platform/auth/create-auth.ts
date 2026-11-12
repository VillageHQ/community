import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";
import { magicLink } from "better-auth/plugins/magic-link";

import * as authSchema from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { runAfterResponse } from "../observability/after-response.ts";
import { resolveAppUrl, resolveTrustedOrigins } from "../http/app-url.ts";
import { createAuthAfterHooks, createAuthGuards } from "./auth-guards.ts";
import { readTrustedClientIp, resolveClientIpHeaders } from "../http/client-ip.ts";
import { readResendConfig } from "../email/resend.ts";
import type { Environment } from "../environment.ts";
import { PASSWORD_RESET_LIFETIME_SECONDS, recordPasswordReset, sendResetEmailSafely } from "./password-recovery.ts";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "./password-policy.ts";
import { AUTH_BASE_PATH } from "../http/routes.ts";
import { createSignInLinkSender, SIGN_IN_LINK_LIFETIME_SECONDS } from "./sign-in-link.ts";

const PASSWORD_RESET_RATE_LIMIT = { window: 60, max: 5 };
const SIGN_IN_LINK_RATE_LIMIT = { window: 60, max: 5 };

type RateLimitRule = { window: number; max: number };

// With no trusted IP header, Better Auth puts every client in one bucket per path, so a few
// wrong passwords from anyone would lock everyone out. There, sign-in uses only its per-account
// limit in the auth guards.
function perIpOnlyWhenKnown(environment: Environment) {
  return (request: Request, current: RateLimitRule) => (readTrustedClientIp(request, environment) ? current : false);
}

// Queuing waits until after the response, so its timing can't tell whether an address has an
// account. Once queued, the outbox keeps the email until it goes out.
function createResetEmailSender(database: Database, environment: Environment) {
  if (!readResendConfig(environment)) return undefined;
  return async ({ user, token }: { user: { id: string }; token: string }) => {
    runAfterResponse(() => sendResetEmailSafely(database, environment, { memberId: user.id, token }));
  };
}

export function createAuth(secret: string, database: Database, environment: Environment) {
  return betterAuth({
    secret,
    baseURL: resolveAppUrl(environment),
    basePath: AUTH_BASE_PATH,
    trustedOrigins: resolveTrustedOrigins(environment),
    database: drizzleAdapter(database, { provider: "pg", schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MINIMUM_PASSWORD_LENGTH,
      maxPasswordLength: MAXIMUM_PASSWORD_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: PASSWORD_RESET_LIFETIME_SECONDS,
      sendResetPassword: createResetEmailSender(database, environment),
      onPasswordReset: ({ user }) => recordPasswordReset(database, user.id, user.name),
    },
    rateLimit: {
      enabled: environment.NODE_ENV !== "development",
      storage: "database",
      customRules: {
        "/sign-in/email": perIpOnlyWhenKnown(environment),
        "/request-password-reset": PASSWORD_RESET_RATE_LIMIT,
        "/reset-password": PASSWORD_RESET_RATE_LIMIT,
        // Per IP only when the IP is known, as for password sign-in; the sender also caps links per address.
        "/sign-in/magic-link": perIpOnlyWhenKnown(environment),
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: resolveClientIpHeaders(environment) },
    },
    hooks: {
      before: createAuthGuards(database, { isEmailOn: readResendConfig(environment) !== null, environment }),
      after: createAuthAfterHooks(database, environment),
    },
    plugins: [
      admin(),
      // Members only: no sign-up, the token is stored hashed and used once. The emailed link opens our confirm
      // page, and only its POST route reaches the verify endpoint (see auth-endpoints.ts).
      magicLink({
        sendMagicLink: createSignInLinkSender(database, environment),
        expiresIn: SIGN_IN_LINK_LIFETIME_SECONDS,
        disableSignUp: true,
        storeToken: "hashed",
        rateLimit: SIGN_IN_LINK_RATE_LIMIT,
      }),
    ],
  });
}
