import { z } from "zod";

import { getDatabase } from "@/database/client";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/lib/body-limit";
import { readRateLimitClientKey } from "@/lib/client-ip";
import { claimFirstAdmin } from "@/lib/first-admin";
import { MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH } from "@/lib/password-policy";
import { withRouteLogging } from "@/lib/route-logging";
import { pruneExpiredRateLimits } from "@/lib/rate-limit-pruning";
import { readJsonBody } from "@/lib/read-json-body";
import { secretsMatch } from "@/lib/secrets-match";
import { recordFailedSetupAttempt } from "@/lib/setup-rate-limit";
import { readSetupToken } from "@/lib/setup-token";

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
        { message: "SETUP_TOKEN is missing or too weak, so setup is disabled." },
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
