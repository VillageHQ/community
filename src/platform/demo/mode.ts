import type { Environment } from "../environment.ts";

// The sales demo (DEMO_MODE=true): a made-up community, one-click sign-in, a nightly reset, and nothing leaving the
// server. Off unless the setting is exactly "true".
const DEMO_MODE_ON = "true";

export const DEMO_EMAIL_DOMAIN = "example.com";
export const DEMO_LABEL = "Demo";
export const DEMO_NOTE = "Made-up people and companies. Everything resets every night.";
// Village calls in demo mode go to this address, and the outside-call guard answers them with canned results.
// `.invalid` can never resolve, so a call that slipped past the guard would fail instead of reaching anyone.
export const DEMO_VILLAGE_API_URL = "https://village.demo.invalid";
// On the sign-in page after a demo button failed: why it did.
export const DEMO_UNAVAILABLE_PARAM = "demo";
export const DEMO_EMAIL_NOTE = "Demo: kept in the sending log, not sent.";

export const DEMO_ACCOUNTS = {
  // Founderhall's order and words: the admin first.
  admin: { email: `maya.ortiz@${DEMO_EMAIL_DOMAIN}`, label: "Try it as Maya (admin)" },
  member: { email: `sam.lee@${DEMO_EMAIL_DOMAIN}`, label: "Try it as Sam (member)" },
} as const;

export type DemoAccount = keyof typeof DEMO_ACCOUNTS;

export function isDemoMode(environment: Environment) {
  return environment.DEMO_MODE === DEMO_MODE_ON;
}

export function isDemoEmail(email: string) {
  return email.trim().toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}

export function readDemoAccount(value: unknown): DemoAccount | null {
  return value === "member" || value === "admin" ? value : null;
}
