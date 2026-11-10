import "server-only";

import { eq } from "drizzle-orm";

import { ASK_ERROR_CODES, ASK_LIMITS, type AskAllowance, type AskHelperBody, type KnowSomeoneBody } from "@/modules/asks/contract";
import { readPostedAskTimes, readWeeklyAllowance } from "@/modules/asks/reads";
import { offerHelp, readAskForHelper, readPathHelperForAuthor, type AllowanceCheck } from "@/modules/asks/service";
import type { PathFinder } from "@/modules/asks/service-helpers";
import { introsManifest } from "@/modules/intros/manifest";
import { readCountedIntroAskTimes } from "@/modules/intros/reads-allowance";
import { createIntroRequest, createOfferedIntro } from "@/modules/intros/service";
import { networkManifest } from "@/modules/network/manifest";
import { NO_OPEN_ASKS, readMemberPaths } from "@/modules/network/service";
import { user } from "@/platform/database/auth-schema";
import type { Database, DatabaseOrTransaction } from "@/platform/database/client";
import type { RequestContext } from "@/platform/http/request-context";
import { RequestError } from "@/platform/http/request-error";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { formatLongDate } from "@/platform/text/format-date";

import { sendOfferAsMessage } from "./ask-offer-delivery";

const CONFLICT_STATUS = 409;
const UNPROCESSABLE_STATUS = 422;
const WEEK_MS = ASK_LIMITS.allowanceWindowDays * 24 * 60 * 60 * 1000;

// One weekly allowance, shared by asks a member posts and intro asks they send. Read here because it spans both
// modules. Each counted ask comes back a week after it was made; an intro ask also comes back when it ends unmade.
export async function readAskAllowance(connection: DatabaseOrTransaction, memberId: string, now = new Date()): Promise<AskAllowance> {
  const [cap, posted, intros] = await Promise.all([
    readWeeklyAllowance(connection),
    readPostedAskTimes(connection, memberId, now),
    readCountedIntroAskTimes(connection, memberId, now),
  ]);
  const times = [...posted, ...intros].map((time) => time.getTime()).toSorted((first, second) => first - second);
  const oldest = times[0];
  return {
    cap,
    used: times.length,
    left: Math.max(0, cap - times.length),
    backAt: oldest === undefined ? null : new Date(oldest + WEEK_MS).toISOString(),
  };
}

export function describeAllowanceUsed({ cap, backAt }: AskAllowance) {
  const when = backAt ? `on ${formatLongDate(backAt)}` : "in a few days";
  return `You've used this week's ${cap} asks. The next one comes back ${when}. An intro ask also comes back if it's declined, expires or you withdraw it.`;
}

// Locks the member's row first, so two asks at once count each other.
export const assertAskAllowance: AllowanceCheck = async (transaction, memberId) => {
  await transaction.select({ id: user.id }).from(user).where(eq(user.id, memberId)).for("no key update");
  const allowance = await readAskAllowance(transaction, memberId);
  if (allowance.left === 0) throw new RequestError(CONFLICT_STATUS, ASK_ERROR_CODES.allowanceUsed, describeAllowanceUsed(allowance));
};

export async function isAskIntroOn(database: Database) {
  return isModuleEnabled(database, introsManifest);
}

// The author's own path lookup: one Village lookup through the credit ledger, cached for a day. Only members who
// joined the group, so only members who agreed to share, come back as connectors.
export const findAskPaths: PathFinder = async (context, targetSlug) => {
  if (!(await isModuleEnabled(context.database, networkManifest))) return null;
  const paths = await readMemberPaths(context, targetSlug, NO_OPEN_ASKS);
  return {
    targetName: paths.targetName,
    helpers: paths.connectors.flatMap(({ member, linkedinSlug, reason }) => (member ? [{ memberId: member.id, connectorSlug: linkedinSlug, reason }] : [])),
  };
};

function introOffError() {
  return new RequestError(CONFLICT_STATUS, ASK_ERROR_CODES.introUnavailable, "Intros are turned off in this community. Offer help with a note instead.");
}

// "I know someone": one two-sided intro with the helper as the connector, and their note on the ask.
export async function knowSomeone(context: RequestContext, body: KnowSomeoneBody) {
  if (!(await isAskIntroOn(context.database))) throw introOffError();
  const target = await readAskForHelper(context.database, body.askId, context.member.id);
  const targetSlug = body.targetLinkedin ?? target.targetSlug;
  if (!targetSlug) {
    throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.introUnavailable, "Paste the LinkedIn link of the person you know.");
  }
  const targetName = body.targetName || (targetSlug === target.targetSlug ? target.targetName : null);
  if (!targetName) throw new RequestError(UNPROCESSABLE_STATUS, ASK_ERROR_CODES.introUnavailable, "Add the name of the person you know.");

  const { id: introId } = await createOfferedIntro(context, { requesterId: target.authorId, askId: body.askId, targetSlug, targetName, note: body.note });
  await offerHelp(context, { askId: body.askId, note: body.note }, sendOfferAsMessage);
  return { introId };
}

// The author asks a path helper for the intro. It is an intro ask like any other, so it uses the allowance and
// counts toward the connector's weekly cap.
export async function askHelperForIntro(context: RequestContext, { askId, helperId, note }: AskHelperBody) {
  if (!(await isAskIntroOn(context.database))) throw introOffError();
  const { targetSlug, connectorSlug } = await readPathHelperForAuthor(context.database, context.member.id, askId, helperId);
  await readMemberPaths(context, targetSlug, NO_OPEN_ASKS);
  const intro = await createIntroRequest(context, { targetSlug, connectorSlug, note }, { assertAllowance: assertAskAllowance, askId });
  return { introId: intro.id };
}
