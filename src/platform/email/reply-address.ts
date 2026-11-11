import { createHmac } from "node:crypto";

import { resolveAuthSecret } from "../auth/auth-secret.ts";
import type { DatabaseOrTransaction } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { secretsMatch } from "../secrets/secrets-match.ts";
import { readReplyDomain } from "../weekly-email/tokens.ts";

// A reply address names what the reply is about (a conversation, an intro, an ask) and is signed for the one
// person the email went to, with the app's auth secret. Nobody can make one for a thing or a person it wasn't sent
// for, and the sender is checked against that person. Weekly emails keep their own older address form.
export const REPLY_KINDS = { message: "m", introAsk: "i", introThread: "t", askHelper: "h" } as const;

export type ReplyKind = (typeof REPLY_KINDS)[keyof typeof REPLY_KINDS];

const PURPOSE = "email-reply";
const PREFIX = "reply+";
const SIGNATURE_LENGTH = 20;
// The kind letters are outside hex, so these never look like a weekly email's `reply+<32 hex>-` address.
const LOCAL_PATTERN = /^reply\+([mith])([0-9a-f]{32})-([0-9a-f]+)$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KIND_LETTERS: readonly string[] = Object.values(REPLY_KINDS);

// Who an address was made for: a member's id, or an outside person's email address.
export type ReplyPerson = { memberId: string } | { email: string };

function personKey(person: ReplyPerson) {
  return "memberId" in person ? `member:${person.memberId}` : `email:${person.email.trim().toLowerCase()}`;
}

// Mail servers may change the case of an address, so the signature is lowercase hex.
function sign(secret: string, kind: ReplyKind, compactId: string, person: ReplyPerson) {
  return createHmac("sha256", secret).update(`${PURPOSE}:${kind}:${compactId}:${personKey(person)}`).digest("hex").slice(0, SIGNATURE_LENGTH);
}

export type ReplySigner = { secret: string; domain: string };

// Null when replies are off (no reply domain), so callers fall back to "reply in the app".
export function readReplySigner(environment: Environment, secret: string): ReplySigner | null {
  const domain = readReplyDomain(environment);
  return domain ? { secret, domain } : null;
}

export async function resolveReplySigner(connection: DatabaseOrTransaction, environment: Environment) {
  if (!readReplyDomain(environment)) return null;
  return readReplySigner(environment, await resolveAuthSecret(connection, environment));
}

export function createReplyAddress({ secret, domain }: ReplySigner, kind: ReplyKind, id: string, person: ReplyPerson) {
  const compactId = id.toLowerCase().replaceAll("-", "");
  return `${PREFIX}${kind}${compactId}-${sign(secret, kind, compactId, person)}@${domain}`;
}

function isReplyKind(value: string): value is ReplyKind {
  return KIND_LETTERS.includes(value);
}

function toUuid(compactId: string) {
  return [compactId.slice(0, 8), compactId.slice(8, 12), compactId.slice(12, 16), compactId.slice(16, 20), compactId.slice(20)].join("-");
}

// An address of ours, before we know whom it was signed for. `isSignedFor` checks a candidate person.
export type ReplyTarget = { kind: ReplyKind; id: string; isSignedFor: (person: ReplyPerson) => boolean };

// Finds the first address on our reply domain in this form, among everything the reply was sent to.
export function readReplyTarget({ secret, domain }: ReplySigner, addresses: readonly string[]): ReplyTarget | null {
  for (const address of addresses) {
    const [local, addressDomain, ...rest] = address.trim().toLowerCase().split("@");
    if (!local || addressDomain !== domain || rest.length > 0) continue;
    const match = LOCAL_PATTERN.exec(local);
    const [, kind, compactId, signature] = match ?? [];
    if (!kind || !compactId || !signature || !isReplyKind(kind)) continue;
    const id = toUuid(compactId);
    if (!UUID_PATTERN.test(id)) continue;
    return { kind, id, isSignedFor: (person) => secretsMatch(signature, sign(secret, kind, compactId, person)) };
  }
  return null;
}
