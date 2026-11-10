import "server-only";

import { and, eq } from "drizzle-orm";

import { ASK_LIMITS, offerHelpBodySchema } from "@/modules/asks/contract";
import { asksManifest } from "@/modules/asks/manifest";
import { isAskStillHelpable } from "@/modules/asks/reads-could-help";
import { offerHelp } from "@/modules/asks/service";
import { skipAsk } from "@/modules/asks/service-skip";
import { INTRO_ACTIONS, introTransitionBodySchema } from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { transitionIntro } from "@/modules/intros/service";
import { isActiveMember } from "@/platform/auth/member-status";
import { user } from "@/platform/database/auth-schema";
import type { Database } from "@/platform/database/client";
import { fetchReceivedText, type ReceivedEmail } from "@/platform/email/inbound";
import { readResendConfig } from "@/platform/email/resend";
import type { Environment } from "@/platform/environment";
import { createRequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";
import { ACTION_SOURCES, claimItemAction, readItemAction, readWeeklyEmail, releaseItemAction, WEEKLY_EMAIL_STATUSES, type ActionSource } from "@/platform/weekly-email/ledger";
import { parseReplyCodes, readEmailAddress, REPLY_CODES } from "@/platform/weekly-email/reply-codes";
import type { WeeklyEmailItem } from "@/platform/weekly-email/schema";
import { readItemToken, readReplyAddress } from "@/platform/weekly-email/tokens";

import { sendOfferAsMessage } from "./ask-offer-delivery";
import { readEnabledIds } from "./enabled-modules";
import { WEEKLY_ITEM_KINDS } from "./today";
import { ITEM_ACTIONS } from "./weekly-email-compose";

// Links and reply codes stop working three weeks after the email, by when its items are stale.
const ANSWERS_LAST_MS = 21 * 24 * 60 * 60_000;
const DEFAULT_HELP_NOTE = "I can help with this. Message me and we'll work it out.";

export const ANSWER_OUTCOMES = {
  done: "done",
  already: "already",
  gone: "gone",
  expired: "expired",
  wrongCode: "wrong_code",
  noItem: "no_item",
} as const;

export type AnswerOutcome = (typeof ANSWER_OUTCOMES)[keyof typeof ANSWER_OUTCOMES];

export type AnswerResult = { outcome: AnswerOutcome; item: WeeklyEmailItem | null; action: string; message: string | null };

const ANSWERABLE_STATUSES: readonly string[] = [WEEKLY_EMAIL_STATUSES.queued, WEEKLY_EMAIL_STATUSES.test];

function actionsFor(item: WeeklyEmailItem): readonly string[] {
  return item.kind === WEEKLY_ITEM_KINDS.intro ? ITEM_ACTIONS.intro : ITEM_ACTIONS.ask;
}

async function readRecipient(database: Database, memberId: string) {
  const [member] = await database
    .select({ id: user.id, email: user.email, role: user.role, name: user.name })
    .from(user)
    .where(and(eq(user.id, memberId), isActiveMember()));
  return member ?? null;
}

// What a link or a code points at, before anything is done. The confirm page reads only this.
export async function readAnswerTarget(database: Database, weeklyEmailId: string, itemNumber: number, action: string, now = new Date()) {
  const row = await readWeeklyEmail(database, weeklyEmailId);
  if (!row || !ANSWERABLE_STATUSES.includes(row.status)) return { outcome: ANSWER_OUTCOMES.gone, row: null, item: null } as const;
  if (now.getTime() - row.createdAt.getTime() > ANSWERS_LAST_MS) return { outcome: ANSWER_OUTCOMES.expired, row, item: null } as const;
  const item = row.items.find(({ number }) => number === itemNumber) ?? null;
  if (!item) return { outcome: ANSWER_OUTCOMES.noItem, row, item: null } as const;
  if (!actionsFor(item).includes(action)) return { outcome: ANSWER_OUTCOMES.wrongCode, row, item } as const;
  return { outcome: null, row, item } as const;
}

type CarriedOut = typeof ANSWER_OUTCOMES.done | typeof ANSWER_OUTCOMES.already | typeof ANSWER_OUTCOMES.gone;

async function carryOut(database: Database, environment: Environment, memberId: string, item: WeeklyEmailItem, action: string, words: string): Promise<CarriedOut> {
  const member = await readRecipient(database, memberId);
  if (!member) return ANSWER_OUTCOMES.gone;
  const enabledIds = await readEnabledIds(database);
  const context = createRequestContext(database, environment, { id: member.id, email: member.email, role: member.role });

  if (item.kind === WEEKLY_ITEM_KINDS.ask) {
    if (!enabledIds.has(asksManifest.id) || !(await isAskStillHelpable(database, member.id, item.ref))) return ANSWER_OUTCOMES.gone;
    if (action === REPLY_CODES.skip) {
      await skipAsk(database, member.id, item.ref);
      return ANSWER_OUTCOMES.done;
    }
    const parsed = offerHelpBodySchema.safeParse({ askId: item.ref, note: words.slice(0, ASK_LIMITS.noteLength) });
    const body = parsed.success ? parsed.data : offerHelpBodySchema.parse({ askId: item.ref, note: DEFAULT_HELP_NOTE });
    // Offered already, in the app: nothing new happens, and the answer says so.
    const { wasAlreadyOffered } = await offerHelp(context, body, sendOfferAsMessage);
    return wasAlreadyOffered ? ANSWER_OUTCOMES.already : ANSWER_OUTCOMES.done;
  }

  if (!enabledIds.has(introsManifest.id)) return ANSWER_OUTCOMES.gone;
  const move = action === REPLY_CODES.yes ? { introId: item.ref, action: INTRO_ACTIONS.accept } : { introId: item.ref, action: INTRO_ACTIONS.decline };
  await transitionIntro(context, introTransitionBodySchema.parse(move));
  return ANSWER_OUTCOMES.done;
}

// Answers one item once. The claim is written first, so a second answer, by link or reply, finds it
// and does nothing. If carrying the answer out fails, the claim is taken back and the item stays open.
export async function answerItem(
  database: Database,
  environment: Environment,
  { weeklyEmailId, itemNumber, action, via, words }: { weeklyEmailId: string; itemNumber: number; action: string; via: ActionSource; words: string },
): Promise<AnswerResult> {
  const target = await readAnswerTarget(database, weeklyEmailId, itemNumber, action);
  if (target.outcome || !target.row || !target.item) return { outcome: target.outcome ?? ANSWER_OUTCOMES.gone, item: target.item ?? null, action, message: null };
  const { row, item } = target;

  if (!(await claimItemAction(database, { weeklyEmailId, itemNumber, action, via }))) {
    const earlier = await readItemAction(database, weeklyEmailId, itemNumber);
    return { outcome: ANSWER_OUTCOMES.already, item, action: earlier?.action ?? action, message: null };
  }
  try {
    const outcome = await carryOut(database, environment, row.memberId, item, action, words.trim());
    // Only a real answer keeps the item's record. "Gone" may change, and "already" was done in the app.
    if (outcome !== ANSWER_OUTCOMES.done) await releaseItemAction(database, weeklyEmailId, itemNumber);
    return { outcome, item, action, message: null };
  } catch (error) {
    await releaseItemAction(database, weeklyEmailId, itemNumber);
    if (error instanceof RequestError) return { outcome: ANSWER_OUTCOMES.gone, item, action, message: error.message };
    throw error;
  }
}

export async function answerFromLink(database: Database, environment: Environment, token: string, words: string) {
  const link = await readItemToken(database, environment, token);
  if (!link) return null;
  return answerItem(database, environment, { ...link, via: ACTION_SOURCES.link, words });
}

export type ReplyResult = { routed: boolean; reason: string | null; results: { code: string; outcome: AnswerOutcome }[] };

async function readReplyText(environment: Environment, received: ReceivedEmail) {
  if (received.text !== null) return received.text;
  const config = readResendConfig(environment);
  if (!config || !received.emailId) return null;
  return fetchReceivedText(config, received.emailId);
}

// A reply to a weekly email. It counts only when it was sent to that email's signed address, from
// the member's own address. Each code at the top acts on its item once.
export async function answerFromReply(database: Database, environment: Environment, received: ReceivedEmail): Promise<ReplyResult> {
  const weeklyEmailId = await readReplyAddress(database, environment, received.to);
  if (!weeklyEmailId) return { routed: false, reason: "not_a_weekly_reply", results: [] };
  const row = await readWeeklyEmail(database, weeklyEmailId);
  const member = row ? await readRecipient(database, row.memberId) : null;
  if (!row || !member) return { routed: true, reason: "gone", results: [] };
  if (readEmailAddress(received.from) !== member.email.trim().toLowerCase()) return { routed: true, reason: "sender_does_not_match", results: [] };

  const text = await readReplyText(environment, received);
  const codes = parseReplyCodes(text ?? "");
  if (codes.length === 0) return { routed: true, reason: "no_codes", results: [] };

  const results: ReplyResult["results"] = [];
  for (const { code, itemNumber, words } of codes) {
    const { outcome } = await answerItem(database, environment, { weeklyEmailId, itemNumber, action: code, via: ACTION_SOURCES.reply, words });
    results.push({ code: `${code.toUpperCase()} ${itemNumber}`, outcome });
  }
  return { routed: true, reason: null, results };
}
