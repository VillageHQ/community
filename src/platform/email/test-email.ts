import { eq } from "drizzle-orm";

import { readBranding } from "../branding/branding.ts";
import { user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { escapeHtml, toSingleLine } from "./email-text.ts";
import { EMAIL_KINDS } from "./kinds.ts";
import { queueEmail } from "./outbox.ts";
import { sendQueuedEmailNow } from "./outbox-sender.ts";
import { readResendConfig } from "./resend.ts";

export const EMAIL_TEST_OUTCOMES = { sent: "sent", queued: "queued", emailOff: "email_off" } as const;

export type EmailTestOutcome = (typeof EMAIL_TEST_OUTCOMES)[keyof typeof EMAIL_TEST_OUTCOMES];

export function renderEmailTest(communityName: string, fromAddress: string) {
  const community = toSingleLine(communityName);
  const subject = `A test from ${community}`;
  const body = `This is the test you asked for in Settings. It was sent as ${toSingleLine(fromAddress)}. If it landed in spam, check the domain's records in Settings.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px"><p style="margin:0">${escapeHtml(body)}</p></div>`;
  return { subject, html, text: body };
}

// Only ever to the admin's own address, read from the database, never typed.
export async function sendEmailTest(database: Database, environment: Environment, adminId: string): Promise<EmailTestOutcome> {
  const config = readResendConfig(environment);
  if (!config) return EMAIL_TEST_OUTCOMES.emailOff;
  const [[admin], branding] = await Promise.all([database.select({ email: user.email }).from(user).where(eq(user.id, adminId)), readBranding(database)]);
  if (!admin) return EMAIL_TEST_OUTCOMES.emailOff;
  const queuedId = await queueEmail(database, environment, {
    kind: EMAIL_KINDS.emailTest,
    to: admin.email,
    memberId: adminId,
    ...renderEmailTest(branding.name, config.fromAddress),
  });
  return (await sendQueuedEmailNow(database, environment, queuedId)) ? EMAIL_TEST_OUTCOMES.sent : EMAIL_TEST_OUTCOMES.queued;
}
