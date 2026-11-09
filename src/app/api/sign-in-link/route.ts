import { z } from "zod";

import { getAuth } from "@/platform/auth/auth";
import { verifySignInLink } from "@/platform/auth/sign-in-link-verify";
import { getDatabase } from "@/platform/database/client";
import { readResendConfig } from "@/platform/email/resend";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { readRateLimitClientKey } from "@/platform/http/client-ip";
import { hasTrustedOrigin } from "@/platform/http/member-route";
import { readJsonBody } from "@/platform/http/read-json-body";
import { platformRoutes } from "@/platform/modules/platform-routes";
import { recordFailedAttempt } from "@/platform/rate-limit/attempt-rate-limit";
import { pruneExpiredRateLimits } from "@/platform/rate-limit/rate-limit-pruning";

const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const GONE_STATUS = 410;
const TOO_MANY_REQUESTS_STATUS = 429;
const MAXIMUM_TOKEN_LENGTH = 256;
const RATE_LIMIT_KEY_PREFIX = "sign-in-link";
const UNUSABLE_MESSAGE = "This link didn't work. It may have expired or been used already. Ask for a new one.";

const bodySchema = z.object({ token: z.string().min(1).max(MAXIMUM_TOKEN_LENGTH) });

function respond(message: string, status: number) {
  return Response.json({ message }, { status });
}

// The POST behind the confirm page's button. The emailed link itself only opens that page.
export const POST = platformRoutes.open(
  "sign-in-link",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    if (!hasTrustedOrigin(request)) return respond("This request came from another site.", FORBIDDEN_STATUS);
    if (!readResendConfig(process.env)) return respond("Sign-in links are off here.", NOT_FOUND_STATUS);

    const database = getDatabase();
    await pruneExpiredRateLimits(database);
    const clientKey = readRateLimitClientKey(request, process.env);
    const { isLimited } = await recordFailedAttempt(database, `${RATE_LIMIT_KEY_PREFIX}|${clientKey}`);
    if (isLimited) return respond("Too many tries. Wait a minute and try again.", TOO_MANY_REQUESTS_STATUS);

    const body = bodySchema.safeParse(await readJsonBody(request));
    if (!body.success) return respond(UNUSABLE_MESSAGE, GONE_STATUS);

    const result = await verifySignInLink(database, await getAuth(), request, body.data.token);
    if (!result.isSignedIn) return respond(UNUSABLE_MESSAGE, GONE_STATUS);

    const headers = new Headers({ "Cache-Control": "no-store" });
    for (const cookie of result.setCookies) headers.append("Set-Cookie", cookie);
    return Response.json({ isPasswordRemoved: result.isPasswordRemoved }, { headers });
  }),
);
