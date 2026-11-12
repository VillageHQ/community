import type { Environment } from "../environment.ts";
import { resolveAppUrl } from "./app-url.ts";

export const STRICT_TRANSPORT_HEADER = "Strict-Transport-Security";
// A year, the usual minimum for browsers' preload lists; no "preload", which only the owner of the domain can promise.
export const STRICT_TRANSPORT_VALUE = "max-age=31536000; includeSubDomains";

// Browsers keep to https on this site once they've seen the header over https. Sent only when the app's own address is
// https, so a local http copy never tells a browser to refuse http on localhost. Read at run time (not in
// next.config.mjs, whose headers are fixed at build time, before a container knows its APP_URL).
export function readStrictTransportValue(environment: Environment) {
  let appUrl: string;
  try {
    appUrl = resolveAppUrl(environment);
  } catch {
    return null;
  }
  return appUrl.startsWith("https://") ? STRICT_TRANSPORT_VALUE : null;
}

export function addStrictTransport<T extends { headers: Headers }>(response: T, environment: Environment) {
  const value = readStrictTransportValue(environment);
  if (value) response.headers.set(STRICT_TRANSPORT_HEADER, value);
  return response;
}
