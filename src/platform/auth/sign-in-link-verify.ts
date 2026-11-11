import "server-only";

import { createHash } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { account, user, verification } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import { isBanActive } from "./member-status.ts";
import { SIGN_IN_LINK_IDENTIFIER_PREFIX } from "./sign-in-link.ts";
import type { getAuth } from "./auth.ts";

const CREDENTIAL_PROVIDER_ID = "credential";
const SUCCESS_STATUS = 200;

type Auth = Awaited<ReturnType<typeof getAuth>>;

export type SignInLinkResult = { isSignedIn: false } | { isSignedIn: true; setCookies: string[]; isPasswordRemoved: boolean };

// The same hash Better Auth's magic-link plugin stores with `storeToken: "hashed"`.
export function toStoredIdentifier(token: string) {
  return `${SIGN_IN_LINK_IDENTIFIER_PREFIX}${createHash("sha256").update(token).digest("base64url")}`;
}

function readLinkEmail(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "email" in parsed && typeof parsed.email === "string") return parsed.email.toLowerCase();
  } catch {}
  return null;
}

// The member a live link signs in, or null.
async function readLinkOwner(database: Database, token: string) {
  const [link] = await database
    .select({ value: verification.value })
    .from(verification)
    .where(and(eq(verification.identifier, toStoredIdentifier(token)), gt(verification.expiresAt, new Date())));
  const email = link ? readLinkEmail(link.value) : null;
  if (!email) return null;

  const [member] = await database
    .select({ id: user.id, email: user.email, emailVerified: user.emailVerified, banned: user.banned, banExpires: user.banExpires })
    .from(user)
    .where(eq(user.email, email));
  if (!member || isBanActive(member)) return null;
  return member;
}

// The confirm page's "Signing in as …": reads a live link without using it. Null: used, expired or unknown.
export async function readSignInLinkEmail(database: Database, token: string) {
  return (await readLinkOwner(database, token))?.email ?? null;
}

// Better Auth signs a not-yet-confirmed account in only after it deletes the account's password and sessions,
// because whoever set them never proved they own the address. Read that first, so the page can say so.
async function readLinkMember(database: Database, token: string) {
  const member = await readLinkOwner(database, token);
  if (!member) return null;

  const [password] = await database
    .select({ id: account.id })
    .from(account)
    .where(and(eq(account.userId, member.id), eq(account.providerId, CREDENTIAL_PROVIDER_ID)));
  return { isPasswordAtRisk: !member.emailVerified && Boolean(password) };
}

export async function verifySignInLink(database: Database, auth: Auth, request: Request, token: string): Promise<SignInLinkResult> {
  const member = await readLinkMember(database, token);
  if (!member) return { isSignedIn: false };

  const response = await auth.api.magicLinkVerify({ query: { token }, headers: request.headers, asResponse: true });
  const setCookies = response.headers.getSetCookie();
  if (response.status !== SUCCESS_STATUS || setCookies.length === 0) return { isSignedIn: false };
  return { isSignedIn: true, setCookies, isPasswordRemoved: member.isPasswordAtRisk };
}
