import { z } from "zod";

import { getDatabase } from "@/platform/database/client";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { readRateLimitClientKey } from "@/platform/http/client-ip";
import { claimFirstAdmin } from "@/platform/auth/first-admin";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "@/platform/auth/password-policy";
import { withRouteLogging } from "@/platform/observability/route-logging";
import { pruneExpiredRateLimits } from "@/platform/rate-limit/rate-limit-pruning";
import { readJsonBody } from "@/platform/http/read-json-body";
import { secretsMatch } from "@/platform/secrets/secrets-match";
import { recordFailedSetupAttempt } from "@/platform/rate-limit/setup-rate-limit";
import { readSetupToken } from "@/platform/secrets/setup-token";

const CREATED_STATUS = 201;
const UNAUTHORIZED_STATUS = 401;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const TOO_MANY_REQUESTS_STATUS = 429;
const NOT_CONFIGURED_STATUS = 503;

const setupTokenSchema = z.object({ token: z.string() });

const firstAdminSchema = z.object({
  name: z.string().trim().min(1, "Enter a name."),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(MINIMUM_PASSWORD_LENGTH, `Use at least ${MINIMUM_PASSWORD_LENGTH} characters.`)
    .max(MAXIMUM_PASSWORD_LENGTH, `Use at most ${MAXIMUM_PASSWORD_LENGTH} characters.`),
});

export const POST = withRouteLogging(
  "setup",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    const setupToken = readSetupToken(process.env);
    if (!setupToken) {
      return Response.json(
        { message: "The setup token is missing or too weak, so setup is off. Reload this page to see how to fix it." },
        { status: NOT_CONFIGURED_STATUS },
      );
    }

    const database = getDatabase();
    const body = await readJsonBody(request);
    const submitted = setupTokenSchema.safeParse(body);
    if (!submitted.success || !secretsMatch(submitted.data.token, setupToken)) {
      const clientKey = readRateLimitClientKey(request, process.env);
      await pruneExpiredRateLimits(database);
      const { isLimited } = await recordFailedSetupAttempt(database, clientKey);
      return Response.json(
        { message: isLimited ? "Too many failed attempts." : "The setup token is wrong." },
        { status: isLimited ? TOO_MANY_REQUESTS_STATUS : UNAUTHORIZED_STATUS },
      );
    }

    const firstAdmin = firstAdminSchema.safeParse(body);
    if (!firstAdmin.success) {
      return Response.json(
        { message: firstAdmin.error.issues[0]?.message ?? "The form is invalid." },
        { status: UNPROCESSABLE_STATUS },
      );
    }

    const { claimed } = await claimFirstAdmin(database, firstAdmin.data);
    if (!claimed) {
      return Response.json({ message: "Setup is already complete." }, { status: CONFLICT_STATUS });
    }

    return Response.json({ message: "Admin created." }, { status: CREATED_STATUS });
  }),
);
