import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins/admin";

import * as authSchema from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { resolveAppUrl, resolveTrustedOrigins } from "./app-url.ts";
import { createAuthGuards } from "./auth-guards.ts";
import { resolveClientIpHeaders } from "./client-ip.ts";
import type { Environment } from "./environment.ts";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "./password-policy.ts";
import { AUTH_BASE_PATH } from "./routes.ts";

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
    },
    rateLimit: {
      enabled: environment.NODE_ENV !== "development",
      storage: "database",
    },
    advanced: {
      ipAddress: { ipAddressHeaders: resolveClientIpHeaders(environment) },
    },
    hooks: { before: createAuthGuards(database) },
    plugins: [admin()],
  });
}
