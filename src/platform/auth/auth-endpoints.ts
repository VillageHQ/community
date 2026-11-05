import { AUTH_BASE_PATH } from "../http/routes.ts";

type AuthEndpoints = Record<string, { path?: string }>;

// Better Auth's limiter writes a row per path before routing, so unknown paths must stop here.
// Parameterized endpoints stay out because this skeleton has no OAuth or password reset emails.
export function isStaticAuthEndpoint(endpoints: AuthEndpoints, pathname: string) {
  return Object.values(endpoints).some(({ path }) => `${AUTH_BASE_PATH}${path}` === pathname);
}
