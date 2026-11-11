import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Transaction } from "../../platform/database/client.ts";
import { pickOnAccent } from "../../platform/design/accent.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail, readEmailBranding, type EmailBranding } from "../../platform/email/outbox.ts";
import { createReplyAddress, REPLY_KINDS, resolveReplySigner } from "../../platform/email/reply-address.ts";
import { sendQueuedEmailsSoon } from "../../platform/email/outbox-sender.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { ASK_HELPER_REASONS, ASKS_PAGE, type AskHelperReason } from "./contract.ts";
import { hasNoBlockBetween, readWordHelpers } from "./reads.ts";
import { ask, askHelper } from "./schema.ts";

const WHY_LENGTH = 300;

export type PathHelper = { memberId: string; connectorSlug: string | null; reason: string };
export type PathLookup = { targetName: string | null; helpers: PathHelper[] };

// Finds members on the author's network path to a LinkedIn profile, only members who agreed to share. The shell
// passes it in, because this module can't use network. Null means no lookup could run.
export type PathFinder = (context: RequestContext, targetSlug: string) => Promise<PathLookup | null>;

type HelperDraft = { helperId: string; reason: AskHelperReason; why: string; connectorSlug: string | null };

function clip(text: string) {
  const single = toSingleLine(removeBidiControls(text));
  return single.length > WHY_LENGTH ? `${single.slice(0, WHY_LENGTH - 1)}…` : single;
}

function describePathWhy(targetName: string | null, reason: string) {
  const person = targetName ?? "the person they want to reach";
  return clip(`May know ${person}: ${reason}`);
}

// Names only the words the ask and the helper share, never their whole profile line.
function describeWordsWhy(sharedWords: readonly string[]) {
  return clip(`Can help with ${sharedWords.join(", ")}`);
}

async function findPathHelpers(context: RequestContext, targetSlug: string | null, findPaths: PathFinder) {
  if (!targetSlug) return null;
  try {
    return await findPaths(context, targetSlug);
  } catch (error) {
    // A Village outage or a member who hasn't joined the network shouldn't stop the ask: word matches still go out.
    logError("ask-path-check", error);
    return null;
  }
}

function mergeHelpers(authorId: string, lookup: PathLookup | null, wordHelpers: Awaited<ReturnType<typeof readWordHelpers>>) {
  const drafts = new Map<string, HelperDraft>();
  for (const { memberId, connectorSlug, reason } of lookup?.helpers ?? []) {
    if (memberId === authorId || drafts.has(memberId)) continue;
    drafts.set(memberId, { helperId: memberId, reason: ASK_HELPER_REASONS.path, why: describePathWhy(lookup?.targetName ?? null, reason), connectorSlug });
  }
  for (const { memberId, sharedWords } of wordHelpers) {
    if (drafts.has(memberId)) continue;
    drafts.set(memberId, { helperId: memberId, reason: ASK_HELPER_REASONS.words, why: describeWordsWhy(sharedWords), connectorSlug: null });
  }
  return [...drafts.values()];
}

type AskForEmail = { id: string; title: string; authorName: string };

export const HELPER_REPLY_LINES = {
  on: "Or reply to this email with what you'd tell them, and we'll post it as your answer under the ask.",
  off: "Reply in the app.",
} as const;

function renderHelperEmail(environment: Environment, branding: EmailBranding, routed: AskForEmail, why: string, canReply: boolean) {
  const authorName = toSingleLine(removeBidiControls(routed.authorName));
  const title = toSingleLine(removeBidiControls(routed.title));
  const link = `${resolveAppUrl(environment)}${ASKS_PAGE}`;
  const subject = `${readFirstName(authorName)} asked for something you may help with`;
  const body = `${authorName} posted an ask in ${branding.name}: "${title}". We thought of you because of this: ${why}`;
  const closing = "If you know someone, or you've done this yourself, one tap on the ask is enough. If not, there's nothing to do.";
  const replyLine = canReply ? HELPER_REPLY_LINES.on : HELPER_REPLY_LINES.off;
  const action = "See the ask";
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427;max-width:520px;margin:0 auto;padding:24px">`,
    `<h1 style="font-size:24px;line-height:30px;margin:0 0 12px">${escapeHtml("Someone may need you")}</h1>`,
    `<p style="margin:0 0 12px">${escapeHtml(body)}</p>`,
    `<p style="margin:0 0 12px">${escapeHtml(closing)}</p>`,
    `<p style="margin:0 0 24px">${escapeHtml(replyLine)}</p>`,
    `<a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:${branding.accentColor};color:${pickOnAccent(branding.accentColor)};font-weight:700;text-decoration:none">${escapeHtml(action)}</a>`,
    `</div>`,
  ].join("");
  return { subject, html, text: `${body}\n\n${closing}\n\n${replyLine}\n\n${action}: ${link}` };
}

// Saves the helpers and queues each one's email in one transaction. A helper already on the ask is skipped, and
// `notified_at` plus the outbox's dedupe key make sure nobody is emailed twice for one ask.
async function saveHelpers(transaction: Transaction, environment: Environment, branding: EmailBranding | null, routed: AskForEmail & { authorId: string }, drafts: HelperDraft[]) {
  if (drafts.length === 0) return 0;
  const reachable = await transaction
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(and(inArray(user.id, drafts.map(({ helperId }) => helperId)), isActiveMember(), hasNoBlockBetween(routed.authorId, user.id)));
  const emails = new Map(reachable.map(({ id, email }) => [id, email]));
  const kept = drafts.filter(({ helperId }) => emails.has(helperId));
  if (kept.length === 0) return 0;
  const saved = await transaction
    .insert(askHelper)
    .values(kept.map((draft) => ({ askId: routed.id, ...draft })))
    .onConflictDoNothing()
    .returning({ helperId: askHelper.helperId, why: askHelper.why });
  if (!branding) return saved.length;

  const signer = await resolveReplySigner(transaction, environment);
  for (const { helperId, why } of saved) {
    const [claimed] = await transaction
      .update(askHelper)
      .set({ notifiedAt: new Date() })
      .where(and(eq(askHelper.askId, routed.id), eq(askHelper.helperId, helperId), isNull(askHelper.notifiedAt)))
      .returning({ helperId: askHelper.helperId });
    const to = emails.get(helperId);
    if (!claimed || !to) continue;
    const replyTo = signer ? createReplyAddress(signer, REPLY_KINDS.askHelper, routed.id, { memberId: helperId }) : null;
    await queueEmail(transaction, environment, {
      kind: EMAIL_KINDS.askHelper,
      to,
      memberId: helperId,
      dedupeKey: `ask-helper-${routed.id}-${helperId}`,
      replyTo,
      ...renderHelperEmail(environment, branding, routed, why, replyTo !== null),
    });
  }
  return saved.length;
}

// Runs after the ask is saved. Finds the members who can help (a path to the person it names, or shared words in
// their "can help with") and emails each of them once. Returns how many helpers it found.
export async function routeAskToHelpers(context: RequestContext, askId: string, findPaths: PathFinder) {
  const { database, environment, member } = context;
  const [routed] = await database
    .select({ id: ask.id, title: ask.title, detail: ask.detail, targetSlug: ask.targetSlug, authorId: ask.authorId, authorName: user.name })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.id, askId), eq(ask.authorId, member.id)));
  if (!routed) return 0;

  const lookup = await findPathHelpers(context, routed.targetSlug, findPaths);
  if (lookup?.targetName) await database.update(ask).set({ targetName: clip(lookup.targetName) }).where(eq(ask.id, askId));
  const wordHelpers = await readWordHelpers(database, member.id, [routed.title, routed.detail ?? ""].join(" "));
  const drafts = mergeHelpers(member.id, lookup, wordHelpers);
  const branding = await readEmailBranding(database, environment);
  const helperCount = await database.transaction((transaction) => saveHelpers(transaction, environment, branding, routed, drafts));
  if (branding && helperCount > 0) sendQueuedEmailsSoon(database, environment);
  return helperCount;
}
