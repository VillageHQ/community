import { getDatabase } from "@/database/client";
import { getAuth } from "@/lib/auth";
import { isStaticAuthEndpoint } from "@/lib/auth-endpoints";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/lib/body-limit";
import { pruneExpiredRateLimits } from "@/lib/rate-limit-pruning";
import { withRouteLogging } from "@/lib/route-logging";

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
