import { z } from "zod";

import { getDatabase } from "@/platform/database/client";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { readRateLimitClientKey } from "@/platform/http/client-ip";
import { readResendConfig } from "@/platform/email/resend";
import { recordFailedAttempt } from "@/platform/rate-limit/attempt-rate-limit";
import { recoverAdminPassword } from "@/platform/auth/password-recovery";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "@/platform/auth/password-policy";
import { pruneExpiredRateLimits } from "@/platform/rate-limit/rate-limit-pruning";
import { readJsonBody } from "@/platform/http/read-json-body";
import { withRouteLogging } from "@/platform/observability/route-logging";
import { secretsMatch } from "@/platform/secrets/secrets-match";
import { readSetupToken } from "@/platform/secrets/setup-token";
import { hasTrustedOrigin } from "@/platform/http/member-route";

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;
const NOT_CONFIGURED_STATUS = 503;
const RATE_LIMIT_KEY_PREFIX = "recover-admin";

const tokenSchema = z.object({ token: z.string() });

const recoverySchema = z.object({
  email: z.email("Enter a valid email address."),
  newPassword: z
    .string()
    .min(MINIMUM_PASSWORD_LENGTH, `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`)
    .max(MAXIMUM_PASSWORD_LENGTH, `Use at most ${MAXIMUM_PASSWORD_LENGTH} characters.`),
});

function respond(message: string, status: number) {
  return Response.json({ message }, { status });
}

export const POST = withRouteLogging(
  "recover-admin",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    if (!hasTrustedOrigin(request)) return respond("This request came from another site.", FORBIDDEN_STATUS);
    if (readResendConfig(process.env)) return respond("Email is on, so use Forgot password instead.", CONFLICT_STATUS);

    const setupToken = readSetupToken(process.env);
    if (!setupToken) return respond("The setup token is missing or too weak, so recovery is off. Set a new one in your host's settings.", NOT_CONFIGURED_STATUS);

    const database = getDatabase();
    const body = await readJsonBody(request);
    const submitted = tokenSchema.safeParse(body);
    if (!submitted.success || !secretsMatch(submitted.data.token, setupToken)) {
      await pruneExpiredRateLimits(database);
      const clientKey = readRateLimitClientKey(request, process.env);
      const { isLimited } = await recordFailedAttempt(database, `${RATE_LIMIT_KEY_PREFIX}|${clientKey}`);
      return isLimited ? respond("Too many failed attempts.", TOO_MANY_REQUESTS_STATUS) : respond("The setup token is wrong.", UNAUTHORIZED_STATUS);
    }

    const recovery = recoverySchema.safeParse(body);
    if (!recovery.success) return respond(recovery.error.issues[0]?.message ?? "The form is invalid.", UNPROCESSABLE_STATUS);

    const isRecovered = await recoverAdminPassword(database, recovery.data);
    if (!isRecovered) return respond("That email isn't an active admin here. This only works for admins.", UNPROCESSABLE_STATUS);
    return Response.json({ message: "Password changed. You can sign in now." });
  }),
);
