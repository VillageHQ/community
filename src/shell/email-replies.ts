import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { answerAskBodySchema, ASK_LIMITS, ASKS_PAGE } from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { askAnswer, askHelper } from "@/modules/asks/schema";
import { answerAsk } from "@/modules/asks/service";
import { consentEmailBodySchema, INTRO_ACTIONS, INTRO_DECLINE_KINDS, INTRO_LIMITS } from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { INTRO_THREAD_AUTHORS, introRequest, type IntroThreadAuthor } from "@/modules/intros/schema";
import { emailConsentLink, transitionIntro } from "@/modules/intros/service";
import { postIntroThreadReply, readIntroThreadParties } from "@/modules/intros/service-thread";
import { MESSAGE_LIMITS, sendMessageBodySchema } from "@/modules/messages/contract";
import { messagesManifest } from "@/modules/messages/manifest";
import { conversation } from "@/modules/messages/schema";
import { sendMessage } from "@/modules/messages/service";
import { isActiveMember } from "@/platform/auth/member-status";
import { user } from "@/platform/database/auth-schema";
import type { Database } from "@/platform/database/client";
import type { ReceivedEmail } from "@/platform/email/inbound";
import { EMAIL_KINDS } from "@/platform/email/kinds";
import { queueEmail, readEmailBranding } from "@/platform/email/outbox";
import { sendQueuedEmailsSoon } from "@/platform/email/outbox-sender";
import { readReplyTargets, REPLY_KINDS, resolveReplySigner, type ReplyKind, type ReplyPerson, type ReplySigner, type ReplyTarget } from "@/platform/email/reply-address";
import { escapeHtml } from "@/platform/email/email-text";
import type { Environment } from "@/platform/environment";
import { resolveAppUrl } from "@/platform/http/app-url";
import { createRequestContext, type RequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";
import { ROUTES } from "@/platform/http/routes";
import { logError } from "@/platform/observability/route-logging";
import { readEmailAddress, stripQuotedReply } from "@/platform/weekly-email/reply-codes";

import { readEnabledIds } from "./enabled-modules";
import { mayMessage } from "./message-policy";
import { readReplyText } from "./weekly-email-answers";

// Replies to a "new message", "asked you for an intro", joint-introduction or helper email. Each reply is checked
// before anything lands: the address must be ours and signed for the person that email went to, and the sender
// must be that person. A reply we can't use gets one plain email saying why. A forged address and automatic mail
// get nothing back, so the app never mails strangers.

export const REPLY_OUTCOMES = { posted: "posted", refused: "refused", ignored: "ignored" } as const;

export const REPLY_REFUSALS = {
  forged: "forged",
  wrongSender: "wrong_sender",
  automatic: "automatic",
  empty: "empty",
  tooLong: "too_long",
  unclear: "unclear",
  closed: "closed",
} as const;

export type EmailReplyResult = { routed: boolean; kind: ReplyKind | null; outcome: string; reason: string | null };

const NOT_ROUTED: EmailReplyResult = { routed: false, kind: null, outcome: REPLY_OUTCOMES.ignored, reason: "not_a_reply" };
const AUTOMATIC_SENDER = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?)[+@]/i;
const EMAIL_IN_TEXT = /[^\s<>"'(),;:]+@[^\s<>"'(),;:]+\.[a-z]{2,}/gi;
const YES_LINES = new Set(["yes", "y", "yes please", "ok", "okay", "sure", "happy to", "yes, happy to"]);
const NO_LINES = new Set(["no", "n", "no thanks", "no thank you", "not this time", "sorry, no"]);
// Founderhall's words (copy/emails/email-reply-did-not-go-through.md); the first line says why.
const BOUNCE_SUBJECT = "Your reply did not go through";
const BOUNCE_LINK_LEAD = "Use this link instead: ";
// Out-of-office and other mail robots: posting them would put "I'm away until Monday" under an ask.
const AUTOMATIC_SUBJECT =
  /^\s*(automatic reply|auto[- ]?reply|autoreply|out of (the )?office|ooo\b|away from (the )?office|vacation reply|abwesenheitsnotiz|r[ée]ponse automatique|respuesta autom[áa]tica)/i;

function isAutomaticReply({ subject, autoSubmitted }: ReceivedEmail) {
  if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== "no") return true;
  return subject !== null && AUTOMATIC_SUBJECT.test(subject);
}

type Member = { id: string; email: string; role: string | null };

// Who the address was signed for, as far as we can tell: a member, or the outside person in an intro thread.
type Recipient = { email: string; member: Member | null; threadAuthor: IntroThreadAuthor | null };

type Resolved = { status: "ok"; recipient: Recipient } | { status: "forged" };

async function readMembers(database: Database, ids: readonly string[]) {
  const rows = await Promise.all(
    ids.map(async (id) => {
      const [row] = await database.select({ id: user.id, email: user.email, role: user.role }).from(user).where(and(eq(user.id, id), isActiveMember()));
      return row ?? null;
    }),
  );
  return rows.filter((row): row is Member => row !== null);
}

function asRecipient(member: Member, threadAuthor: IntroThreadAuthor | null = null): Recipient {
  return { email: member.email, member, threadAuthor };
}

async function resolveMemberAmong(database: Database, target: ReplyTarget, ids: readonly string[]): Promise<Resolved> {
  const signedFor = ids.find((id) => target.isSignedFor({ memberId: id }));
  if (!signedFor) return { status: "forged" };
  const [member] = await readMembers(database, [signedFor]);
  // Signed, but the member is gone: nothing to land, and nobody to tell.
  return member ? { status: "ok", recipient: asRecipient(member) } : { status: "forged" };
}

async function resolveRecipient(database: Database, target: ReplyTarget): Promise<Resolved> {
  if (target.kind === REPLY_KINDS.message) {
    const [row] = await database.select({ low: conversation.memberLowId, high: conversation.memberHighId }).from(conversation).where(eq(conversation.id, target.id));
    return row ? resolveMemberAmong(database, target, [row.low, row.high]) : { status: "forged" };
  }
  if (target.kind === REPLY_KINDS.introAsk) {
    const [row] = await database.select({ introducerId: introRequest.introducerId }).from(introRequest).where(eq(introRequest.id, target.id));
    return row ? resolveMemberAmong(database, target, [row.introducerId]) : { status: "forged" };
  }
  if (target.kind === REPLY_KINDS.askHelper) {
    const rows = await database.select({ helperId: askHelper.helperId }).from(askHelper).where(eq(askHelper.askId, target.id));
    return resolveMemberAmong(database, target, rows.map(({ helperId }) => helperId));
  }
  const parties = await readIntroThreadParties(database, target.id);
  if (!parties) return { status: "forged" };
  const asTarget: ReplyPerson = { email: parties.targetEmail };
  if (target.isSignedFor(asTarget)) return { status: "ok", recipient: { email: parties.targetEmail, member: null, threadAuthor: INTRO_THREAD_AUTHORS.target } };
  // The connector is copied on the introduction, so their replies land in the thread too.
  const resolved = await resolveMemberAmong(database, target, [parties.requesterId, parties.introducerId]);
  if (resolved.status !== "ok") return resolved;
  const isConnector = target.isSignedFor({ memberId: parties.introducerId });
  return { status: "ok", recipient: { ...resolved.recipient, threadAuthor: isConnector ? INTRO_THREAD_AUTHORS.introducer : INTRO_THREAD_AUTHORS.requester } };
}

// A stable message key per received email, so a webhook Resend sends twice posts once.
function readClientKey(emailId: string | null) {
  if (!emailId) return randomUUID();
  const hex = createHash("sha256").update(`email-reply:${emailId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// YES or NO alone on the first line, with an email address after a YES allowed. "No problem, happy to" is
// neither, so a chatty first line asks again instead of guessing.
export function readFirstLineAnswer(text: string) {
  const first = (text.split("\n").find((line) => line.trim()) ?? "")
    .replace(EMAIL_IN_TEXT, "")
    // Mail apps write a linked address as <…> or <mailto:…>; what's left of the brackets isn't part of the answer.
    .replace(/<\s*(mailto:)?\s*>/gi, "")
    .trim()
    .toLowerCase()
    .replace(/[\s.!,:;-]+$/, "")
    .trim();
  if (YES_LINES.has(first)) return INTRO_ACTIONS.accept;
  if (NO_LINES.has(first)) return INTRO_ACTIONS.decline;
  return null;
}

// Only the YES line, or a line right after it that holds nothing but an address, counts, as the email asks ("put
// their email on the next line"): a signature, a quoted "On … wrote:" line or a colleague's address further down never
// gets the note.
const ADDRESS_ONLY_LINE = /^<?\s*(mailto:)?\s*[^\s<>@]+@[^\s<>@]+\s*>?$/i;

function readOutsideAddress(text: string, exclude: readonly string[], replyDomain: string) {
  const [first = "", second = ""] = text.split("\n").filter((line) => line.trim());
  const lines = ADDRESS_ONLY_LINE.test(second.trim()) ? `${first} ${second}` : first;
  return (lines.match(EMAIL_IN_TEXT) ?? [])
    .map((address) => address.toLowerCase())
    .find((address) => !exclude.includes(address) && !address.endsWith(`@${replyDomain}`));
}

// `linkLead`: words before the link on its line ("Use this link instead: "); `withSignOff`: Founderhall's last line.
type Notice = { to: string; subject: string; lines: readonly string[]; link: string; dedupeKey: string; linkLead?: string; withSignOff?: boolean };

// One plain email: why a reply didn't land, or the next step after a YES. Transactional, no topic.
async function sendNotice(database: Database, environment: Environment, { to, subject, lines, link, dedupeKey, linkLead = "", withSignOff = false }: Notice) {
  try {
    const branding = await readEmailBranding(database, environment);
    if (!branding) return;
    const signOff = withSignOff ? [`Sent by ${branding.name} via its member portal.`] : [];
    const text = [...lines, `${linkLead}${link}`, ...signOff].join("\n\n");
    const html = [
      `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
      ...lines.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`),
      `<p style="margin:0">${escapeHtml(linkLead)}<a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>`,
      ...signOff.map((line) => `<p style="margin:12px 0 0">${escapeHtml(line)}</p>`),
      `</div>`,
    ].join("");
    const queued = await queueEmail(database, environment, { kind: EMAIL_KINDS.replyNotice, to, memberId: null, subject, html, text, dedupeKey });
    if (queued) sendQueuedEmailsSoon(database, environment);
  } catch (error) {
    logError("email-reply-notice", error);
  }
}

function placeLink(environment: Environment, kind: ReplyKind, id: string) {
  const appUrl = resolveAppUrl(environment);
  if (kind === REPLY_KINDS.message) return `${appUrl}${ROUTES.messages}/${id}`;
  if (kind === REPLY_KINDS.askHelper) return `${appUrl}${ASKS_PAGE}`;
  if (kind === REPLY_KINDS.introAsk) return `${appUrl}${ROUTES.intros}/${id}`;
  return appUrl;
}

// At most one bounce per address per day, however many replies fail, so two mail robots can't loop through us.
async function bounce(database: Database, environment: Environment, to: string, why: string, link: string) {
  const day = new Date().toISOString().slice(0, 10);
  await sendNotice(database, environment, {
    to,
    subject: BOUNCE_SUBJECT,
    lines: [why],
    link,
    linkLead: BOUNCE_LINK_LEAD,
    withSignOff: true,
    dedupeKey: `reply-bounce:${to}:${day}`,
  });
}

function refused(kind: ReplyKind, reason: string): EmailReplyResult {
  return { routed: true, kind, outcome: REPLY_OUTCOMES.refused, reason };
}

function posted(kind: ReplyKind): EmailReplyResult {
  return { routed: true, kind, outcome: REPLY_OUTCOMES.posted, reason: null };
}

const LENGTH_LIMITS: Record<ReplyKind, number> = {
  [REPLY_KINDS.message]: MESSAGE_LIMITS.bodyLength,
  // Only the first line counts here, so a long signature that slipped through doesn't matter.
  [REPLY_KINDS.introAsk]: Number.POSITIVE_INFINITY,
  [REPLY_KINDS.introThread]: INTRO_LIMITS.threadMessageLength,
  [REPLY_KINDS.askHelper]: ASK_LIMITS.answerLength,
};

const MODULE_BY_KIND: Record<ReplyKind, string> = {
  [REPLY_KINDS.message]: messagesManifest.id,
  [REPLY_KINDS.introAsk]: introsManifest.id,
  [REPLY_KINDS.introThread]: introsManifest.id,
  [REPLY_KINDS.askHelper]: asksManifest.id,
};

type Landing = { database: Database; environment: Environment; signer: ReplySigner; target: ReplyTarget; recipient: Recipient; text: string; emailId: string | null };

function contextFor({ database, environment }: Landing, member: Member): RequestContext {
  return createRequestContext(database, environment, { id: member.id, email: member.email, role: member.role });
}

async function answerIntroAsk(landing: Landing, member: Member): Promise<EmailReplyResult> {
  const { database, environment, signer, target, recipient, text } = landing;
  const action = readFirstLineAnswer(text);
  const link = placeLink(environment, target.kind, target.id);
  if (!action) {
    await bounce(database, environment, recipient.email, "We couldn't read a YES or NO on its first line.", link);
    return refused(target.kind, REPLY_REFUSALS.unclear);
  }
  const context = contextFor(landing, member);
  if (action === INTRO_ACTIONS.decline) {
    await transitionIntro(context, { introId: target.id, action, reason: null, kind: INTRO_DECLINE_KINDS.notThisTime });
    return posted(target.kind);
  }
  const moved = await transitionIntro(context, { introId: target.id, action });
  const consentLink = moved.consentIssue?.link;
  const address = readOutsideAddress(text, [recipient.email], signer.domain);
  const parsed = address && moved.consentIssue ? consentEmailBodySchema.safeParse({ introId: target.id, token: moved.consentIssue.token, targetEmail: address }) : null;
  let lines = [`Thanks for the yes. Next, ${moved.target.name} needs to say yes too. Send them this link, where they read the note and answer:`];
  if (parsed?.success) {
    try {
      await emailConsentLink(context, parsed.data);
      lines = [`Thanks for the yes. We emailed ${moved.target.name} at ${parsed.data.targetEmail}, and we'll let you both know when they answer. Their link, if you'd like to send it yourself too:`];
    } catch (error) {
      if (!(error instanceof RequestError)) throw error;
      lines = [`Thanks for the yes. We couldn't email ${moved.target.name}: ${error.message} Send them this link instead:`];
    }
  }
  if (consentLink) {
    await sendNotice(database, environment, { to: recipient.email, subject: `Next step for ${moved.requester.name}'s intro`, lines, link: consentLink, dedupeKey: `reply-yes:${target.id}` });
  }
  return posted(target.kind);
}

async function readAnswerBody(database: Database, answerId: string) {
  const [row] = await database.select({ body: askAnswer.body }).from(askAnswer).where(eq(askAnswer.id, answerId));
  return row?.body ?? null;
}

async function land(landing: Landing): Promise<EmailReplyResult> {
  const { database, environment, signer, target, recipient, text, emailId } = landing;
  const { member } = recipient;
  if (target.kind === REPLY_KINDS.introThread) {
    if (!recipient.threadAuthor) return refused(target.kind, REPLY_REFUSALS.forged);
    await postIntroThreadReply(database, environment, signer, { introId: target.id, author: recipient.threadAuthor, body: text, sourceEmailId: emailId });
    return posted(target.kind);
  }
  if (!member) return refused(target.kind, REPLY_REFUSALS.forged);
  if (target.kind === REPLY_KINDS.introAsk) return answerIntroAsk(landing, member);
  if (target.kind === REPLY_KINDS.message) {
    const body = sendMessageBodySchema.parse({ conversationId: target.id, clientKey: readClientKey(emailId), body: text });
    await sendMessage(contextFor(landing, member), body, mayMessage, { isViaEmail: true });
    return posted(target.kind);
  }
  const body = answerAskBodySchema.parse({ askId: target.id, body: text });
  const { id, wasAlreadyAnswered } = await answerAsk(contextFor(landing, member), body);
  // The same reply sent again (Resend retries a webhook) finds its own answer: nothing to tell anyone.
  if (wasAlreadyAnswered && (await readAnswerBody(database, id)) === body.body) return posted(target.kind);
  if (wasAlreadyAnswered) {
    await bounce(database, environment, recipient.email, "You've already answered this ask. You can see your answer under it.", placeLink(environment, target.kind, target.id));
    return refused(target.kind, REPLY_REFUSALS.closed);
  }
  return posted(target.kind);
}

// Null when the reply wasn't sent to one of these addresses: the weekly email's router, or nobody, handles it.
export async function answerEmailReply(database: Database, environment: Environment, received: ReceivedEmail): Promise<EmailReplyResult> {
  const signer = await resolveReplySigner(database, environment);
  if (!signer) return NOT_ROUTED;
  const targets = readReplyTargets(signer, received.to);
  const [first] = targets;
  if (!first) return NOT_ROUTED;

  const sender = readEmailAddress(received.from);
  const isAutomatic = !sender || AUTOMATIC_SENDER.test(sender) || sender.endsWith(`@${signer.domain}`) || isAutomaticReply(received);
  if (isAutomatic) return refused(first.kind, REPLY_REFUSALS.automatic);
  // Among our addresses whose signature checks out, the one made for the sender wins; else the first. A made-up one
  // beside them changes nothing.
  let found: { target: ReplyTarget; recipient: Recipient } | null = null;
  for (const candidate of targets) {
    const resolved = await resolveRecipient(database, candidate);
    if (resolved.status !== "ok") continue;
    found ??= { target: candidate, recipient: resolved.recipient };
    if (resolved.recipient.email.trim().toLowerCase() === sender) {
      found = { target: candidate, recipient: resolved.recipient };
      break;
    }
  }
  if (!found) return refused(first.kind, REPLY_REFUSALS.forged);
  const { target, recipient } = found;
  const link = placeLink(environment, target.kind, target.id);
  // The address is real, but someone else sent the reply (a forward, a shared inbox). Nothing of theirs is kept.
  if (sender !== recipient.email.trim().toLowerCase()) {
    await bounce(database, environment, sender, "It came from a different address than the one we emailed.", link);
    return refused(target.kind, REPLY_REFUSALS.wrongSender);
  }

  if (!(await readEnabledIds(database)).has(MODULE_BY_KIND[target.kind])) {
    await bounce(database, environment, sender, "That part of the community is switched off.", resolveAppUrl(environment));
    return refused(target.kind, REPLY_REFUSALS.closed);
  }
  const text = stripQuotedReply((await readReplyText(environment, received)) ?? "");
  if (!text) {
    await bounce(database, environment, sender, "It was empty once we took out the email you replied to.", link);
    return refused(target.kind, REPLY_REFUSALS.empty);
  }
  if (text.length > LENGTH_LIMITS[target.kind]) {
    await bounce(database, environment, sender, `It's longer than ${LENGTH_LIMITS[target.kind]} characters.`, link);
    return refused(target.kind, REPLY_REFUSALS.tooLong);
  }

  try {
    return await land({ database, environment, signer, target, recipient, text, emailId: received.emailId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      await bounce(database, environment, sender, "We couldn't read it as a reply.", link);
      return refused(target.kind, REPLY_REFUSALS.empty);
    }
    if (!(error instanceof RequestError)) throw error;
    await bounce(database, environment, sender, error.message, link);
    return refused(target.kind, REPLY_REFUSALS.closed);
  }
}
