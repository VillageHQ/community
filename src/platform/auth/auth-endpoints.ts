import { AUTH_BASE_PATH } from "../http/routes.ts";

type AuthEndpoints = Record<string, { path?: string }>;

// Better Auth's limiter writes a row per path before routing, so unknown paths must stop here.
// Parameterized endpoints stay out because this skeleton has no OAuth or password reset emails.
// Reachable on the server only: the sign-in link's verify endpoint signs in on a GET, which a mail scanner would
// trigger, so only the confirm page's POST route (/api/sign-in-link) calls it.
const SERVER_ONLY_PATHS: ReadonlySet<string> = new Set(["/magic-link/verify"]);

export function isStaticAuthEndpoint(endpoints: AuthEndpoints, pathname: string) {
  if ([...SERVER_ONLY_PATHS].some((path) => `${AUTH_BASE_PATH}${path}` === pathname)) return false;
  return Object.values(endpoints).some(({ path }) => `${AUTH_BASE_PATH}${path}` === pathname);
}
