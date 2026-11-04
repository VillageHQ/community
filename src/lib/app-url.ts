import type { Environment } from "./environment.ts";

const LOCAL_DEVELOPMENT_URL = "http://localhost:3000";
const VERCEL_PREVIEW_ENVIRONMENT = "preview";

function toOrigin(url: string) {
  return new URL(url).origin;
}

function fromDomain(domain: string) {
  return toOrigin(`https://${domain}`);
}

function readVercelPreviewOrigin(environment: Environment) {
  if (environment.VERCEL_ENV !== VERCEL_PREVIEW_ENVIRONMENT) return null;
  if (!environment.VERCEL_URL) return null;
  return fromDomain(environment.VERCEL_URL);
}

export function resolveAppUrl(environment: Environment) {
  if (environment.APP_URL) return toOrigin(environment.APP_URL);
  if (environment.RAILWAY_PUBLIC_DOMAIN) return fromDomain(environment.RAILWAY_PUBLIC_DOMAIN);

  const vercelPreviewOrigin = readVercelPreviewOrigin(environment);
  if (vercelPreviewOrigin) return vercelPreviewOrigin;

  if (environment.VERCEL_PROJECT_PRODUCTION_URL) {
    return fromDomain(environment.VERCEL_PROJECT_PRODUCTION_URL);
  }
  if (environment.NODE_ENV !== "production") return LOCAL_DEVELOPMENT_URL;

  throw new Error("Cannot resolve the app URL. Set APP_URL.");
}

export function resolveTrustedOrigins(environment: Environment) {
  const origins = new Set([resolveAppUrl(environment)]);
  const vercelPreviewOrigin = readVercelPreviewOrigin(environment);
  if (vercelPreviewOrigin) origins.add(vercelPreviewOrigin);
  return [...origins];
}
