import { createHmac } from "node:crypto";

import { resolveAuthSecret } from "../auth/auth-secret.ts";
import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { secretsMatch } from "../secrets/secrets-match.ts";

// Links and reply addresses carry no state of their own: each is the weekly email's id signed with
// the app's auth secret, so nobody can make one for an email that isn't theirs.
const LINK_PURPOSE = "weekly-email-item";
const REPLY_PURPOSE = "weekly-email-reply";
const TOKEN_SEPARATOR = ".";
const REPLY_PREFIX = "reply+";
const REPLY_SIGNATURE_LENGTH = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ACTION_PATTERN = /^[a-z]{1,16}$/;
const REPLY_LOCAL_PATTERN = /^reply\+([0-9a-f]{32})-([0-9a-f]+)$/;
const MAXIMUM_ITEM_NUMBER = 999;

export type ItemLink = { weeklyEmailId: string; itemNumber: number; action: string };

function sign(secret: string, purpose: string, payload: string) {
  return createHmac("sha256", secret).update(`${purpose}:${payload}`).digest("base64url");
}

export async function createItemToken(database: Database, environment: Environment, { weeklyEmailId, itemNumber, action }: ItemLink) {
  const payload = [weeklyEmailId, itemNumber, action].join(TOKEN_SEPARATOR);
  return `${payload}${TOKEN_SEPARATOR}${sign(await resolveAuthSecret(database, environment), LINK_PURPOSE, payload)}`;
}

export async function readItemToken(database: Database, environment: Environment, token: string): Promise<ItemLink | null> {
  const [weeklyEmailId, numberText, action, signature, ...rest] = token.split(TOKEN_SEPARATOR);
  if (!weeklyEmailId || !numberText || !action || !signature || rest.length > 0) return null;
  if (!UUID_PATTERN.test(weeklyEmailId) || !ACTION_PATTERN.test(action)) return null;
  const itemNumber = Number(numberText);
  if (!Number.isInteger(itemNumber) || itemNumber < 1 || itemNumber > MAXIMUM_ITEM_NUMBER || String(itemNumber) !== numberText) return null;
  const payload = [weeklyEmailId, numberText, action].join(TOKEN_SEPARATOR);
  if (!secretsMatch(signature, sign(await resolveAuthSecret(database, environment), LINK_PURPOSE, payload))) return null;
  return { weeklyEmailId, itemNumber, action };
}

// Mail servers may change the case of an address, so the reply address uses lowercase hex only.
function signReply(secret: string, compactId: string) {
  return createHmac("sha256", secret).update(`${REPLY_PURPOSE}:${compactId}`).digest("hex").slice(0, REPLY_SIGNATURE_LENGTH);
}

export function readReplyDomain(environment: Environment) {
  const domain = environment.RESEND_REPLY_DOMAIN?.trim().toLowerCase().replace(/^@/, "");
  return domain || null;
}

export async function createReplyAddress(database: Database, environment: Environment, weeklyEmailId: string) {
  const domain = readReplyDomain(environment);
  if (!domain) return null;
  const compactId = weeklyEmailId.replaceAll("-", "");
  return `${REPLY_PREFIX}${compactId}-${signReply(await resolveAuthSecret(database, environment), compactId)}@${domain}`;
}

function toUuid(compactId: string) {
  return [compactId.slice(0, 8), compactId.slice(8, 12), compactId.slice(12, 16), compactId.slice(16, 20), compactId.slice(20)].join("-");
}

// Finds our signed address among everything the reply was sent to, and returns its weekly email.
export async function readReplyAddress(database: Database, environment: Environment, addresses: readonly string[]) {
  const domain = readReplyDomain(environment);
  if (!domain) return null;
  const secret = await resolveAuthSecret(database, environment);
  for (const address of addresses) {
    const [local, addressDomain, ...rest] = address.trim().toLowerCase().split("@");
    if (!local || addressDomain !== domain || rest.length > 0) continue;
    const match = REPLY_LOCAL_PATTERN.exec(local);
    if (!match?.[1] || !match[2]) continue;
    if (secretsMatch(match[2], signReply(secret, match[1]))) return toUuid(match[1]);
  }
  return null;
}
