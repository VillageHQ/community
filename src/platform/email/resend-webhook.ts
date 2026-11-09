import { createHmac } from "node:crypto";

import { z } from "zod";

import type { DatabaseOrTransaction } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { secretsMatch } from "../secrets/secrets-match.ts";
import { emailSuppression } from "./schema.ts";

// Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body" with the base64
// secret after its "whsec_" prefix. Old timestamps are refused so a captured call can't be replayed.
const SECRET_PREFIX = "whsec_";
const SIGNATURE_VERSION = "v1";
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export const SUPPRESSION_REASONS = { bounced: "bounced", complained: "complained" } as const;

const SUPPRESSING_EVENTS: Readonly<Record<string, string>> = {
  "email.bounced": SUPPRESSION_REASONS.bounced,
  "email.complained": SUPPRESSION_REASONS.complained,
};

const webhookEventSchema = z.object({
  type: z.string(),
  data: z.object({ to: z.union([z.string(), z.array(z.string())]).optional() }).optional(),
});

type SignedRequest = { id: string | null; timestamp: string | null; signature: string | null; body: string };

export function readResendWebhookSecret(environment: Environment) {
  return environment.RESEND_WEBHOOK_SECRET?.trim() || null;
}

export function signResendWebhook(secret: string, id: string, timestamp: string, body: string) {
  const key = Buffer.from(secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret, "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
}

export function isResendWebhookSigned(secret: string, { id, timestamp, signature, body }: SignedRequest, nowMs = Date.now()) {
  if (!id || !timestamp || !signature) return false;
  const sentAtSeconds = Number(timestamp);
  if (!Number.isFinite(sentAtSeconds) || Math.abs(nowMs / 1000 - sentAtSeconds) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const expected = signResendWebhook(secret, id, timestamp, body);
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    return version === SIGNATURE_VERSION && value !== undefined && secretsMatch(value, expected);
  });
}

export function readSuppressedAddresses(body: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const event = webhookEventSchema.safeParse(parsed);
  if (!event.success) return null;
  const reason = SUPPRESSING_EVENTS[event.data.type];
  const to = event.data.data?.to ?? [];
  if (!reason) return { reason: null, emails: [] };
  return { reason, emails: (Array.isArray(to) ? to : [to]).map((email) => email.trim().toLowerCase()).filter(Boolean) };
}

export async function suppressEmails(connection: DatabaseOrTransaction, emails: readonly string[], reason: string) {
  if (emails.length === 0) return;
  await connection
    .insert(emailSuppression)
    .values(emails.map((email) => ({ email, reason })))
    .onConflictDoNothing();
}
