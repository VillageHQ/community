import { getAuth } from "@/platform/auth/auth";
import { getDatabase } from "@/platform/database/client";
import { DEMO_UNAVAILABLE_PARAM, isDemoMode, readDemoAccount } from "@/platform/demo/mode";
import { signInDemoAccount } from "@/platform/demo/sign-in";
import { MAXIMUM_JSON_BODY_BYTES, withBodyLimit } from "@/platform/http/body-limit";
import { hasTrustedOrigin } from "@/platform/http/member-route";
import { ROUTES } from "@/platform/http/routes";
import { platformRoutes } from "@/platform/modules/platform-routes";

const SEE_OTHER_STATUS = 303;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;

function redirectTo(path: string, cookies: readonly string[] = []) {
  const headers = new Headers({ Location: path, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: SEE_OTHER_STATUS, headers });
}

// The "Try the demo" buttons on the sign-in page post here. With DEMO_MODE off this route doesn't exist.
export const POST = platformRoutes.open(
  "demo-sign-in",
  withBodyLimit(MAXIMUM_JSON_BODY_BYTES, async (request) => {
    if (!isDemoMode(process.env)) return Response.json({ message: "Not found." }, { status: NOT_FOUND_STATUS });
    if (!hasTrustedOrigin(request)) return Response.json({ message: "This request came from another site." }, { status: FORBIDDEN_STATUS });

    const form = await request.formData().catch(() => null);
    const account = readDemoAccount(form?.get("who"));
    if (!account) return redirectTo(`${ROUTES.signIn}?${DEMO_UNAVAILABLE_PARAM}=unknown`);

    const result = await signInDemoAccount(getDatabase(), await getAuth(), request, account);
    if (!result.isSignedIn) return redirectTo(`${ROUTES.signIn}?${DEMO_UNAVAILABLE_PARAM}=missing`);
    return redirectTo(ROUTES.feed, result.setCookies);
  }),
);
