import { getIP } from "@better-auth/core/utils/ip";

import type { Environment } from "../environment.ts";

const SHARED_BUCKET_KEY = "no-trusted-ip";

const PLATFORM_CLIENT_IP_HEADERS = [
  { environmentKey: "VERCEL", header: "x-vercel-forwarded-for" },
  { environmentKey: "RAILWAY_PROJECT_ID", header: "x-real-ip" },
];

export function resolveClientIpHeaders(environment: Environment) {
  if (environment.CLIENT_IP_HEADER) return [environment.CLIENT_IP_HEADER.toLowerCase()];

  const platform = PLATFORM_CLIENT_IP_HEADERS.find(({ environmentKey }) => {
    return environment[environmentKey];
  });
  return platform ? [platform.header] : [];
}

// The client's IP from a header this host can trust, or null when none of those headers came.
// Better Auth's getIP answers 127.0.0.1 in development and tests, which isn't a real client.
export function readTrustedClientIp(request: Request | Headers, environment: Environment) {
  const ipAddressHeaders = resolveClientIpHeaders(environment);
  const headers = request instanceof Request ? request.headers : request;
  if (!ipAddressHeaders.some((header) => headers.get(header))) return null;
  return getIP(request, { advanced: { ipAddress: { ipAddressHeaders } } }) ?? null;
}

// Setup-token and invite guesses share one bucket when the IP is unknown. That is the safe side
// for a secret: guessing slows for everyone, and nobody's sign-in depends on it.
export function readRateLimitClientKey(request: Request | Headers, environment: Environment) {
  const ipAddress = { ipAddressHeaders: resolveClientIpHeaders(environment) };
  return getIP(request, { advanced: { ipAddress } }) ?? SHARED_BUCKET_KEY;
}
