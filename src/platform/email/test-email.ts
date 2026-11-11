import { eq } from "drizzle-orm";

import { readBranding } from "../branding/branding.ts";
import { user } from "../database/auth-schema.ts";
import type { Database } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { escapeHtml, toSingleLine } from "./email-text.ts";
import { EMAIL_KINDS } from "./kinds.ts";
import { queueEmail } from "./outbox.ts";
import { readSenderConfig, sendQueuedEmailNow } from "./outbox-sender.ts";
import { splitFromAddress } from "./mail-settings.ts";
import { readResendConfig } from "./resend.ts";

export const EMAIL_TEST_OUTCOMES = { sent: "sent", queued: "queued", emailOff: "email_off" } as const;

export type EmailTestOutcome = (typeof EMAIL_TEST_OUTCOMES)[keyof typeof EMAIL_TEST_OUTCOMES];

// Founderhall's mail test (copy/emails/email-mail-test.md), word for word: plain words, the HTML part says the same.
export function renderEmailTest(communityName: string, fromAddress: string) {
  const community = toSingleLine(communityName);
  const sender = splitFromAddress(toSingleLine(fromAddress)).address;
  const subject = `Test from ${community}`;
  const lines = [`This is a test from ${community}' portal. If it reached your inbox (not spam), sending from ${sender} works.`, `Sent by ${community} via its member portal.`];
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#1b2420;max-width:520px;margin:0 auto;padding:24px">${lines.map((line) => `<p style="margin:0 0 16px">${escapeHtml(line)}</p>`).join("")}</div>`;
  return { subject, html, text: lines.join("\n\n") };
}

// Only ever to the admin's own address, read from the database, never typed.
export async function sendEmailTest(database: Database, environment: Environment, adminId: string): Promise<EmailTestOutcome> {
  const config = readResendConfig(environment);
  if (!config) return EMAIL_TEST_OUTCOMES.emailOff;
  const [[admin], branding] = await Promise.all([database.select({ email: user.email }).from(user).where(eq(user.id, adminId)), readBranding(database)]);
  if (!admin) return EMAIL_TEST_OUTCOMES.emailOff;
  const sender = await readSenderConfig(database, config);
  const queuedId = await queueEmail(database, environment, {
    kind: EMAIL_KINDS.emailTest,
    to: admin.email,
    memberId: adminId,
    ...renderEmailTest(branding.name, sender.fromAddress),
  });
  return (await sendQueuedEmailNow(database, environment, queuedId)) ? EMAIL_TEST_OUTCOMES.sent : EMAIL_TEST_OUTCOMES.queued;
}
