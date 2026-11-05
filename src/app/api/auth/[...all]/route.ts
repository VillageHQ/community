import { getDatabase } from "@/platform/database/client";
import { getAuth } from "@/platform/auth/auth";
import { isStaticAuthEndpoint } from "@/platform/auth/auth-endpoints";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { pruneExpiredRateLimits } from "@/platform/rate-limit/rate-limit-pruning";
import { withRouteLogging } from "@/platform/observability/route-logging";

const NOT_FOUND_STATUS = 404;

const handleAuthRequest = withRouteLogging(
  "auth",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    const auth = await getAuth();
    if (!isStaticAuthEndpoint(auth.api, new URL(request.url).pathname)) {
      return Response.json({ message: "Not found." }, { status: NOT_FOUND_STATUS });
    }
    await pruneExpiredRateLimits(getDatabase());
    return auth.handler(request);
  }),
);

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;
