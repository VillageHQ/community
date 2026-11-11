import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { AUDIT_ACTIONS } from "../../platform/audit/actions.ts";
import { withAdminTransaction } from "../../platform/audit/admin-transaction.ts";
import { recordAdminAction } from "../../platform/audit/record.ts";
import { isActiveMember } from "../../platform/auth/member-status.ts";
import { user } from "../../platform/database/auth-schema.ts";
import type { Transaction } from "../../platform/database/client.ts";
import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { clipLine, describeEmailFoot, renderPlainTextHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { EMAIL_KINDS } from "../../platform/email/kinds.ts";
import { queueEmail, readEmailBranding } from "../../platform/email/outbox.ts";
import { sendQueuedEmailsSoon } from "../../platform/email/outbox-sender.ts";
import { resolveAppUrl } from "../../platform/http/app-url.ts";
import type { RequestContext } from "../../platform/http/request-context.ts";
import { RequestError } from "../../platform/http/request-error.ts";
import { logAdminAction } from "../../platform/observability/route-logging.ts";
import {
  ASK_ANSWER_KINDS,
  ASK_CONSENT,
  ASK_ERROR_CODES,
  ASK_HELP_KINDS,
  ASK_KINDS,
  ASK_OUTCOMES,
  ASK_STATES,
  ASK_STATUS_ACTIONS,
  toAskPage,
  type AskHelpKind,
  type AskStatusBody,
  type HelpAskBody,
} from "./contract.ts";
import { hasNoBlockBetween } from "./reads.ts";
import { readAskState } from "./rules-state.ts";
import { ask, askAnswer, askHelper, askOffer } from "./schema.ts";
import { closeAsk, reopenAsk, removeAsk, setAskPinned } from "./service.ts";

const NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;
const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const ASK_IN_EMAIL_LENGTH = 160;

function askGoneError() {
  return new RequestError(NOT_FOUND_STATUS, ASK_ERROR_CODES.notFound, "This ask is no longer open.");
}

// The words a helper leaves when they write nothing (Founderhall's help()).
function readDefaultHelpLine(kind: AskHelpKind, person: string | null) {
  if (kind === ASK_HELP_KINDS.knowSomeone) return `I know ${person ?? "someone"} and can introduce you.`;
  return "I’ve done this myself. Happy to talk it through.";
}

type HelpOfferedEmail = { communityName: string; authorName: string; helperName: string; kind: AskHelpKind; note: string; person: string | null; askTitle: string; link: string };

// Founderhall's helpOffered, word for word.
export function renderHelpOfferedEmail({ communityName, authorName, helperName, kind, note, person, askTitle, link }: HelpOfferedEmail) {
  const helper = readFirstName(helperName);
  const isKnowSomeone = kind === ASK_HELP_KINDS.knowSomeone;
  const head = isKnowSomeone ? `${helperName} knows someone for your ask${person ? `: ${person}` : ""}.` : `${helperName} has done this before and can help with your ask.`;
  const text = [
    `Hi ${readFirstName(authorName)},`,
    "",
    head,
    "",
    `Your ask: ${clipLine(askTitle, ASK_IN_EMAIL_LENGTH)}`,
    ...(note ? ["", `${helper} wrote:`, "", `  ${note.split("\n").join("\n  ")}`] : []),
    "",
    isKnowSomeone ? `Write the note ${helper} forwards (we drafted it from your profile): ${link}` : `Open the ask to answer: ${link}`,
    "",
    ASK_CONSENT,
    "",
    describeEmailFoot(communityName),
  ].join("\n");
  const subject = isKnowSomeone ? `${helper} can introduce you${person ? ` to ${person}` : ""}` : `${helper} can help with your ask`;
  return { subject, html: renderPlainTextHtml(text), text };
}

async function lockAskToHelp(transaction: Transaction, askId: string, helperId: string) {
  const [target] = await transaction
    .select({ authorId: ask.authorId, authorName: user.name, authorEmail: user.email, title: ask.title, kind: ask.kind, listedAt: ask.listedAt, closedAt: ask.closedAt })
    .from(ask)
    .innerJoin(user, eq(user.id, ask.authorId))
    .where(and(eq(ask.id, askId), isActiveMember(), hasNoBlockBetween(helperId, ask.authorId)))
    .for("share", { of: ask });
  if (!target || target.kind !== ASK_KINDS.ask || readAskState(target, new Date()) !== ASK_STATES.open) throw askGoneError();
  if (target.authorId === helperId) throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.ownAsk, "This is your own ask.");
  return target;
}

// "I can help": the helper's line goes under the ask (Knows someone, or Has done this), the asker hears by email,
// and Community's private offer is kept too, so the asker's offers count stays right. A path helper's person is the
// one they know when they name nobody.
export async function helpWithAsk(context: RequestContext, { askId, kind, person, note }: HelpAskBody) {
  const { database, environment, member } = context;
  const branding = await readEmailBranding(database, environment);
  const result = await database.transaction(async (transaction) => {
    const target = await lockAskToHelp(transaction, askId, member.id);
    const [helper] = await transaction.select({ name: user.name }).from(user).where(eq(user.id, member.id));
    const [routed] = await transaction
      .select({ personName: askHelper.personName })
      .from(askHelper)
      .where(and(eq(askHelper.askId, askId), eq(askHelper.helperId, member.id)));
    const knownPerson = person ?? (kind === ASK_HELP_KINDS.knowSomeone ? (routed?.personName ?? null) : null);
    const body = note || readDefaultHelpLine(kind, knownPerson);
    const [created] = await transaction
      .insert(askAnswer)
      .values({ askId, authorId: member.id, body, kind: kind === ASK_HELP_KINDS.knowSomeone ? ASK_ANSWER_KINDS.knowSomeone : ASK_ANSWER_KINDS.doneMyself })
      .returning({ id: askAnswer.id });
    await transaction.insert(askOffer).values({ askId, helperId: member.id, note: clipLine(body, 500) }).onConflictDoNothing();
    if (branding) {
      await queueEmail(transaction, environment, {
        kind: EMAIL_KINDS.askHelpOffered,
        to: target.authorEmail,
        memberId: target.authorId,
        dedupeKey: `ask-help-${created?.id ?? askId}`,
        ...renderHelpOfferedEmail({
          communityName: branding.name,
          authorName: toSingleLine(target.authorName),
          helperName: toSingleLine(helper?.name ?? ""),
          kind,
          note,
          person: knownPerson,
          askTitle: target.title,
          link: `${resolveAppUrl(environment)}${toAskPage(askId)}`,
        }),
      });
    }
    return { answerId: created?.id ?? null };
  });
  if (branding) sendQueuedEmailsSoon(database, environment);
  return result;
}

// An admin closes someone else's ask: it ends as "no longer needed", and the audit log says who.
async function closeAskAsAdmin({ database, member }: RequestContext, askId: string) {
  await withAdminTransaction(database, member.id, async (transaction) => {
    const [target] = await transaction
      .select({ authorId: ask.authorId, authorName: user.name, title: ask.title })
      .from(ask)
      .innerJoin(user, eq(user.id, ask.authorId))
      .where(and(eq(ask.id, askId), isNull(ask.closedAt)))
      .for("update", { of: ask });
    if (!target) throw new RequestError(CONFLICT_STATUS, ASK_ERROR_CODES.closed, "This ask is already closed.");
    await transaction.update(ask).set({ closedAt: new Date(), outcome: ASK_OUTCOMES.noLongerNeeded, pinnedAt: null, pinnedByUserId: null }).where(eq(ask.id, askId));
    await recordAdminAction(transaction, member.id, { action: AUDIT_ACTIONS.askClosed, targetMemberId: target.authorId, targetName: target.authorName, detail: target.title });
  });
  logAdminAction("ask_closed", member.id, askId);
}

async function readAskAuthor(context: RequestContext, askId: string) {
  const [row] = await context.database.select({ authorId: ask.authorId, kind: ask.kind }).from(ask).where(eq(ask.id, askId));
  if (!row) throw askGoneError();
  return row;
}

// Founderhall's status buttons on the ask's page. The author: Mark answered, Reopen. An admin: also Pin, Unpin,
// Close and Remove. An update can't be answered or reopened.
export async function setAskStatus(context: RequestContext, { askId, action }: AskStatusBody, isAdmin: boolean) {
  const { authorId, kind } = await readAskAuthor(context, askId);
  const isOwn = authorId === context.member.id;
  const forbidden = new RequestError(FORBIDDEN_STATUS, ASK_ERROR_CODES.notFound, "Only the member who asked, or an admin, can do that.");
  const isAnswerAction = action === ASK_STATUS_ACTIONS.answered || action === ASK_STATUS_ACTIONS.reopen;
  if (isAnswerAction && kind !== ASK_KINDS.ask) throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.notAnAsk, "An update can't be answered.");
  switch (action) {
    case ASK_STATUS_ACTIONS.answered:
      if (isOwn) return closeAsk(context, { askId, outcome: ASK_OUTCOMES.solvedHere });
      if (isAdmin) return closeAskAsAdmin(context, askId);
      throw forbidden;
    case ASK_STATUS_ACTIONS.reopen:
      if (!isOwn && !isAdmin) throw forbidden;
      return reopenAsk(context, askId, isAdmin);
    case ASK_STATUS_ACTIONS.close:
      if (isOwn) return closeAsk(context, { askId, outcome: ASK_OUTCOMES.noLongerNeeded });
      if (isAdmin) return closeAskAsAdmin(context, askId);
      throw forbidden;
    case ASK_STATUS_ACTIONS.pin:
    case ASK_STATUS_ACTIONS.unpin:
      if (!isAdmin) throw forbidden;
      return setAskPinned(context, { askId, isPinned: action === ASK_STATUS_ACTIONS.pin });
    case ASK_STATUS_ACTIONS.remove:
      if (!isAdmin) throw forbidden;
      return removeAsk(context, askId);
  }
}
