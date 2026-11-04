import { getIP } from "@better-auth/core/utils/ip";

import type { Environment } from "./environment.ts";

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

export function readRateLimitClientKey(request: Request, environment: Environment) {
  const ipAddress = { ipAddressHeaders: resolveClientIpHeaders(environment) };
  return getIP(request, { advanced: { ipAddress } }) ?? SHARED_BUCKET_KEY;
}
