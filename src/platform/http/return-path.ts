import { ROUTES } from "./routes.ts";

export const RETURN_PATH_PARAM = "next";

const RETURN_PATH_PREFIX = `${ROUTES.confirmEmail}?`;
const SAFE_QUERY = /^[A-Za-z0-9_=&-]*$/;

export function parseReturnPath(value: string | undefined) {
  if (!value?.startsWith(RETURN_PATH_PREFIX)) return null;
  return SAFE_QUERY.test(value.slice(RETURN_PATH_PREFIX.length)) ? value : null;
}

export function toSignInPath(returnPath: string) {
  return `${ROUTES.signIn}?${RETURN_PATH_PARAM}=${encodeURIComponent(returnPath)}`;
}
