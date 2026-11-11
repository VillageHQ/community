import { eq, lte } from "drizzle-orm";

import { user } from "../../platform/database/auth-schema.ts";
import type { Transaction } from "../../platform/database/client.ts";
import { pickOnAccent } from "../../platform/design/accent.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { isEmailWanted, queueEmail, type EmailBranding } from "../../platform/email/outbox.ts";
import { createReplyAddress, REPLY_KINDS, resolveReplySigner } from "../../platform/email/reply-address.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import { ROUTES } from "../../platform/http/routes.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { messageEmailNotice } from "./schema.ts";

export const MESSAGE_EMAIL_WINDOW_MS = 15 * 60 * 1000;

type MessageEmailFacts = { senderName: string; communityName: string; link: string; accentColor: string; canReply: boolean };

// The email never carries the message itself: it says who wrote and links to the conversation. With a reply
// address, replying to it posts the reply into the conversation.
export function renderMessageEmail({ senderName, communityName, link, accentColor, canReply }: MessageEmailFacts) {
  const sender = toSingleLine(senderName);
  const community = toSingleLine(communityName);
  const subject = `${sender} sent you a message`;
  const body = `${sender} sent you a message in ${community}.`;
  const replyLine = canReply ? `Reply to this email to answer ${sender}, or read it in the app.` : "Reply in the app.";
  const action = "Read and reply";
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">New message</h1>`,
    `<p style="margin:0 0 12px">${escapeHtml(body)}</p>`,
    `<p style="margin:0 0 24px">${escapeHtml(replyLine)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${accentColor};color:${pickOnAccent(accentColor)};font-weight:700;text-decoration:none">${escapeHtml(action)}</a>`,
    `</div>`,
  ].join("");
  return { subject, html, text: `${body}\n\n${replyLine}\n\n${action}: ${link}` };
}

// Claims the window for this recipient and conversation. Two messages sent at once can't both
// claim it, because the conversation row stays locked for the whole send.
async function claimEmailWindow(transaction: Transaction, conversationId: string, recipientId: string) {
  const now = new Date();
  const claimed = await transaction
    .insert(messageEmailNotice)
    .values({ conversationId, recipientId, emailedAt: now })
    .onConflictDoUpdate({
      target: [messageEmailNotice.conversationId, messageEmailNotice.recipientId],
      set: { emailedAt: now },
      setWhere: lte(messageEmailNotice.emailedAt, new Date(now.getTime() - MESSAGE_EMAIL_WINDOW_MS)),
    })
    .returning({ emailedAt: messageEmailNotice.emailedAt });
  return claimed.length > 0;
}

type NewMessage = { conversationId: string; senderId: string; recipientId: string };

export async function queueMessageEmail(
  transaction: Transaction,
  environment: Environment,
  branding: EmailBranding | null,
  { conversationId, senderId, recipientId }: NewMessage,
) {
  if (!branding) return null;
  const [recipient] = await transaction.select({ email: user.email }).from(user).where(eq(user.id, recipientId));
  if (!recipient) return null;
  const email = { kind: EMAIL_KINDS.directMessage, to: recipient.email, memberId: recipientId };
  if (!(await isEmailWanted(transaction, email))) return null;
  if (!(await claimEmailWindow(transaction, conversationId, recipientId))) return null;

  const [sender] = await transaction.select({ name: user.name }).from(user).where(eq(user.id, senderId));
  const link = `${resolveAppUrl(environment)}${ROUTES.messages}/${conversationId}`;
  const signer = await resolveReplySigner(transaction, environment);
  const replyTo = signer ? createReplyAddress(signer, REPLY_KINDS.message, conversationId, { memberId: recipientId }) : null;
  return queueEmail(transaction, environment, {
    ...email,
    replyTo,
    ...renderMessageEmail({
      senderName: removeBidiControls(sender?.name ?? "A member"),
      communityName: branding.name,
      link,
      accentColor: branding.accentColor,
      canReply: replyTo !== null,
    }),
  });
}
