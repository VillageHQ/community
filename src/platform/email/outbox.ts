import { and, eq } from "drizzle-orm";

import { readBranding } from "../branding/branding.ts";
import type { Database, DatabaseOrTransaction } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { readEmailTopic, type EmailKind } from "./kinds.ts";
import { readResendConfig } from "./resend.ts";
import { emailOptOut, emailOutbox, emailSuppression } from "./schema.ts";

export const OUTBOX_STATUSES = {
  pending: "pending",
  sending: "sending",
  sent: "sent",
  failed: "failed",
  skipped: "skipped",
} as const;

export type QueuedEmail = {
  kind: EmailKind;
  to: string;
  memberId: string | null;
  subject: string;
  html: string;
  text: string;
};

// An optional email (one with a topic) goes only to a member who left that topic on, at an
// address that never bounced or complained. The sender checks again, since either can change.
export async function isEmailWanted(connection: DatabaseOrTransaction, { kind, to, memberId }: { kind: string; to: string; memberId: string | null }) {
  const topic = readEmailTopic(kind);
  if (!topic) return true;
  if (!memberId) return false;

  const [optedOut] = await connection
    .select({ topic: emailOptOut.topic })
    .from(emailOptOut)
    .where(and(eq(emailOptOut.memberId, memberId), eq(emailOptOut.topic, topic)));
  if (optedOut) return false;
  const [suppressed] = await connection
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(eq(emailSuppression.email, to.trim().toLowerCase()));
  return !suppressed;
}

// Read before opening the transaction: a second connection taken inside one can exhaust the
// pool when many requests arrive at once. Null means email is off, so there is nothing to queue.
export async function readEmailBranding(database: Database, environment: Environment) {
  return readResendConfig(environment) ? readBranding(database) : null;
}

export type EmailBranding = Awaited<ReturnType<typeof readBranding>>;

// Call this inside the transaction that makes the change the email is about. It returns the row
// id, or null when email is off or the person doesn't want this kind.
export async function queueEmail(connection: DatabaseOrTransaction, environment: Environment, email: QueuedEmail) {
  if (!readResendConfig(environment)) return null;
  if (!(await isEmailWanted(connection, email))) return null;

  const [queued] = await connection
    .insert(emailOutbox)
    .values({
      kind: email.kind,
      toEmail: email.to,
      memberId: email.memberId,
      subject: email.subject,
      html: email.html,
      text: email.text,
    })
    .returning({ id: emailOutbox.id });
  return queued?.id ?? null;
}
