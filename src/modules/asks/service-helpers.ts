import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Transaction } from "../../platform/database/client.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { clipLine, describeEmailFoot, renderPlainTextHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { UNSUBSCRIBE_URL_MARK } from "../../platform/email/unsubscribe.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail, readEmailBranding, type EmailBranding } from "../../platform/email/outbox.ts";
import { createReplyAddress, REPLY_KINDS, resolveReplySigner } from "../../platform/email/reply-address.ts";
import { sendQueuedEmailsSoon } from "../../platform/email/outbox-sender.ts";
import type { Environment } from "../../platform/environment.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { logError } from "../../platform/observability/route-logging.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { ASK_CONSENT, ASK_HELPER_REASONS, ASK_WARMTHS, describeAskWho, describeWhyYou, toAskPage, type AskHelperReason, type HelperReasonLine } from "./contract.ts";
import { hasNoBlockBetween, readWordHelpers } from "./reads.ts";
import { ask, askHelper } from "./schema.ts";

const WHY_LENGTH = 300;

// A member on the author's path. `reason` is how they know the person ("Worked together at …"); `warmth` how well.
export type PathHelper = { memberId: string; connectorSlug: string | null; reason: string; warmth?: string | null; personTitle?: string | null };
export type PathLookup = { targetName: string | null; helpers: PathHelper[] };

// Finds members on the author's network path to the person the ask is trying to reach: a LinkedIn profile, or the
// words of "Who are you trying to reach?" and the company. Only members who agreed to share. The shell passes it in,
// because this module can't use network. Null means no lookup could run.
export type PathTarget = { targetSlug: string | null; targetText: string | null; targetCompany: string | null };
export type PathFinder = (context: RequestContext, target: PathTarget) => Promise<PathLookup | null>;

type HelperDraft = {
  helperId: string;
  reason: AskHelperReason;
  why: string;
  connectorSlug: string | null;
  personName: string | null;
  personTitle: string | null;
  warmth: string | null;
};

const PROFILE_LINE_LENGTH = 90;

function clip(text: string) {
  const single = toSingleLine(removeBidiControls(text));
  return single.length > WHY_LENGTH ? `${single.slice(0, WHY_LENGTH - 1)}…` : single;
}

// Founderhall's profile reason: the helper's own "can help with" line, quoted (it is on their profile already).
function describeWordsWhy(canHelpWith: string, sharedWords: readonly string[]) {
  const line = toSingleLine(canHelpWith);
  if (!line) return clip(`can help with ${sharedWords.join(", ")}`);
  const quoted = line.length > PROFILE_LINE_LENGTH ? `${line.slice(0, PROFILE_LINE_LENGTH - 2).replace(/\s+\S*$/, "")}…` : line;
  return clip(`can help with “${quoted}”`);
}

function readWarmth(warmth: string | null | undefined) {
  return warmth && Object.values(ASK_WARMTHS).includes(warmth as never) ? warmth : null;
}

async function findPathHelpers(context: RequestContext, target: PathTarget, findPaths: PathFinder) {
  if (!target.targetSlug && !target.targetText && !target.targetCompany) return null;
  try {
    return await findPaths(context, target);
  } catch (error) {
    // A Village outage or a member who hasn't joined the network shouldn't stop the ask: word matches still go out.
    logError("ask-path-check", error);
    return null;
  }
}

function mergeHelpers(authorId: string, lookup: PathLookup | null, wordHelpers: Awaited<ReturnType<typeof readWordHelpers>>) {
  const drafts = new Map<string, HelperDraft>();
  for (const { memberId, connectorSlug, reason, warmth, personTitle } of lookup?.helpers ?? []) {
    if (memberId === authorId || drafts.has(memberId)) continue;
    drafts.set(memberId, {
      helperId: memberId,
      reason: ASK_HELPER_REASONS.path,
      why: clip(reason),
      connectorSlug,
      personName: lookup?.targetName ? clip(lookup.targetName) : null,
      personTitle: personTitle ? clip(personTitle) : null,
      warmth: readWarmth(warmth),
    });
  }
  for (const { memberId, sharedWords, canHelpWith } of wordHelpers) {
    if (drafts.has(memberId)) continue;
    drafts.set(memberId, { helperId: memberId, reason: ASK_HELPER_REASONS.words, why: describeWordsWhy(canHelpWith, sharedWords), connectorSlug: null, personName: null, personTitle: null, warmth: null });
  }
  return [...drafts.values()];
}

type AskForEmail = { id: string; title: string; authorName: string; targetText: string | null; targetCompany: string | null; targetName: string | null };

export const HELPER_REPLY_LINES = {
  on: "Or reply to this email: your reply shows under the ask, from you. Start it with HELP if you know someone.",
  off: "",
} as const;

const SUBJECT_ASK_LENGTH = 70;

// Founderhall's askForHelp, word for word, as plain text.
export function renderHelperEmail(environment: Environment, branding: EmailBranding, routed: AskForEmail, helper: { name: string } & HelperReasonLine, canReply: boolean) {
  const authorName = toSingleLine(removeBidiControls(routed.authorName));
  const author = readFirstName(authorName);
  const title = toSingleLine(removeBidiControls(routed.title));
  const who = describeAskWho(routed);
  const link = `${resolveAppUrl(environment)}${toAskPage(routed.id)}`;
  const text = [
    `Hi ${readFirstName(helper.name)},`,
    "",
    `${authorName} posted an ask in ${branding.name}:`,
    "",
    `  ${title}`,
    ...(who ? ["", `Trying to reach: ${who}`] : []),
    "",
    `Why you: ${describeWhyYou(helper)}`,
    "",
    `Open the ask and say "I can help": ${link}`,
    ...(canReply ? [HELPER_REPLY_LINES.on] : []),
    "",
    `${ASK_CONSENT} If you know someone, ${author} writes the note and you decide whether to forward it.`,
    "",
    `Stop emails about asks you could help with: ${UNSUBSCRIBE_URL_MARK}`,
    "",
    describeEmailFoot(branding.name),
  ].join("\n");
  return { subject: `${author} asks: ${clipLine(title, SUBJECT_ASK_LENGTH)}`, html: renderPlainTextHtml(text), text };
}

// Saves the helpers and queues each one's email in one transaction. A helper already on the ask is skipped, and
// `notified_at` plus the outbox's dedupe key make sure nobody is emailed twice for one ask.
async function saveHelpers(transaction: Transaction, environment: Environment, branding: EmailBranding | null, routed: AskForEmail & { authorId: string }, drafts: HelperDraft[]) {
  if (drafts.length === 0) return 0;
  const reachable = await transaction
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(and(inArray(user.id, drafts.map(({ helperId }) => helperId)), isActiveMember(), hasNoBlockBetween(routed.authorId, user.id)));
  const emails = new Map(reachable.map(({ id, email }) => [id, email]));
  const names = new Map(reachable.map(({ id, name }) => [id, name]));
  const kept = drafts.filter(({ helperId }) => emails.has(helperId));
  if (kept.length === 0) return 0;
  const saved = await transaction
    .insert(askHelper)
    .values(kept.map((draft) => ({ askId: routed.id, ...draft })))
    .onConflictDoNothing()
    .returning({ helperId: askHelper.helperId, why: askHelper.why, reason: askHelper.reason, personName: askHelper.personName, personTitle: askHelper.personTitle, warmth: askHelper.warmth });
  if (!branding) return saved.length;

  const signer = await resolveReplySigner(transaction, environment);
  for (const { helperId, ...reasonLine } of saved) {
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
      ...renderHelperEmail(environment, branding, routed, { name: names.get(helperId) ?? "", ...reasonLine }, replyTo !== null),
    });
  }
  return saved.length;
}

// Runs after the ask is saved. Finds the members who can help (a path to the person it names, or shared words in
// their "can help with") and emails each of them once. Returns how many helpers it found.
export async function routeAskToHelpers(context: RequestContext, askId: string, findPaths: PathFinder) {
  const { database, environment, member } = context;
  const [routed] = await database
    .select({
      id: ask.id,
      title: ask.title,
      detail: ask.detail,
      targetSlug: ask.targetSlug,
      targetText: ask.targetText,
      targetCompany: ask.targetCompany,
      targetName: ask.targetName,
      authorId: ask.authorId,
      authorName: user.name,
    })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.id, askId), eq(ask.authorId, member.id)));
  if (!routed) return 0;

  const lookup = await findPathHelpers(context, routed, findPaths);
  if (lookup?.targetName && routed.targetSlug) await database.update(ask).set({ targetName: clip(lookup.targetName) }).where(eq(ask.id, askId));
  // Founderhall matches profiles on who the ask is trying to reach, or on the ask itself when it names nobody.
  const matchText = routed.targetText || routed.targetCompany ? [routed.targetText ?? "", routed.targetCompany ?? ""].join(" ") : [routed.title, routed.detail ?? ""].join(" ");
  const wordHelpers = await readWordHelpers(database, member.id, matchText);
  const drafts = mergeHelpers(member.id, lookup, wordHelpers);
  const branding = await readEmailBranding(database, environment);
  const helperCount = await database.transaction((transaction) => saveHelpers(transaction, environment, branding, routed, drafts));
  if (branding && helperCount > 0) sendQueuedEmailsSoon(database, environment);
  return helperCount;
}
