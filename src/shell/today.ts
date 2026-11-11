import "server-only";

import { asksManifest } from "@/modules/asks/manifest";
import { readOwnAsks } from "@/modules/asks/reads";
import { readAsksYouCouldHelp } from "@/modules/asks/reads-could-help";
import { ASK_STATES, type OwnAsk } from "@/modules/asks/contract";
import type { HelpableAsk } from "@/modules/asks/contract-today";
import { INTRO_STATES, type Intro } from "@/modules/intros/contract";
import { introsManifest } from "@/modules/intros/manifest";
import { readIntroBoard, readWaitingIntros } from "@/modules/intros/reads";
import { readOpenOwnPosts, type BoardPost } from "@/modules/asks/reads-board";
import type { LineToCheck } from "@/modules/members/contract-fill-in";
import { readNewMembers } from "@/modules/members/reads-directory";
import { readLinesToCheck } from "@/modules/members/service-fill-in";
import type { Database } from "@/platform/database/client";
import type { WeeklyEmailItem } from "@/platform/weekly-email/schema";
import { isAskIntroOn, readAskAllowance } from "@/shell/ask-helpers";

// What needs one member this week. The home page and the weekly email both read it, so they can't
// disagree. A section whose feature is off is empty.
export type TodayItems = {
  helpableAsks: HelpableAsk[];
  introsToAnswer: Intro[];
  introsToFinish: Intro[];
  // Words public profiles put on the member's card this past week, to check on Today.
  profileLines: LineToCheck[];
  ownAsks: OwnAsk[];
  // Founderhall's "Your asks in motion": your open asks with their one line, and your open intro asks.
  ownPosts: BoardPost[];
  introsInMotion: Intro[];
  newMembers: Awaited<ReturnType<typeof readNewMembers>>["newMembers"];
  newMemberCount: number;
};

const INTROS_IN_MOTION: ReadonlySet<string> = new Set([INTRO_STATES.requested, INTRO_STATES.accepted, INTRO_STATES.askingTarget, INTRO_STATES.targetAgreed]);

export const WEEKLY_ITEM_KINDS = { ask: "ask", intro: "intro" } as const;

export type WeeklyItemKind = (typeof WEEKLY_ITEM_KINDS)[keyof typeof WEEKLY_ITEM_KINDS];

async function readOwnAsksForToday(database: Database, memberId: string, now: Date) {
  const [allowance, canIntro] = await Promise.all([readAskAllowance(database, memberId, now), isAskIntroOn(database)]);
  return readOwnAsks(database, memberId, { allowance, canIntro }, now);
}

export async function readTodayItems(database: Database, memberId: string, enabledIds: ReadonlySet<string>, now = new Date()): Promise<TodayItems> {
  const isAsksOn = enabledIds.has(asksManifest.id);
  const isIntrosOn = enabledIds.has(introsManifest.id);
  const [helpableAsks, ownAsks, waitingIntros, { newCount, newMembers }, profileLines, ownPosts, introBoard] = await Promise.all([
    isAsksOn ? readAsksYouCouldHelp(database, memberId, now) : [],
    isAsksOn ? readOwnAsksForToday(database, memberId, now) : null,
    isIntrosOn ? readWaitingIntros(database, memberId) : [],
    readNewMembers(database, memberId, now),
    readLinesToCheck(database, memberId),
    isAsksOn ? readOpenOwnPosts(database, memberId, now) : [],
    isIntrosOn ? readIntroBoard(database, memberId) : null,
  ]);
  return {
    helpableAsks,
    introsToAnswer: waitingIntros.filter(({ state }) => state === INTRO_STATES.requested),
    introsToFinish: waitingIntros.filter(({ state }) => state !== INTRO_STATES.requested),
    profileLines,
    ownAsks: ownAsks?.asks.filter(({ state }) => state === ASK_STATES.open) ?? [],
    ownPosts,
    introsInMotion: introBoard?.yourAsks.filter(({ state }) => INTROS_IN_MOTION.has(state)) ?? [],
    newMembers,
    newMemberCount: newCount,
  };
}

export function describeIntroAsk(intro: Intro) {
  return `${intro.requester.name} asks you to introduce them to ${intro.target.name}`;
}

// The numbers a member answers by: asks first, then intros. Only things with a yes or no get one.
export function numberWeeklyItems({ helpableAsks, introsToAnswer }: TodayItems): WeeklyEmailItem[] {
  const unnumbered = [
    ...helpableAsks.map(({ id, title }) => ({ kind: WEEKLY_ITEM_KINDS.ask, ref: id, title })),
    ...introsToAnswer.map((intro) => ({ kind: WEEKLY_ITEM_KINDS.intro, ref: intro.id, title: describeIntroAsk(intro) })),
  ];
  return unnumbered.map((item, index) => ({ ...item, number: index + 1 }));
}

// Something to answer or finish. New members, your own asks and lines to check alone don't make an
// email: the weekly email has no way to answer a line yet.
export function needsMemberThisWeek(items: TodayItems) {
  return items.helpableAsks.length + items.introsToAnswer.length + items.introsToFinish.length > 0;
}

export function isTodayEmpty(items: TodayItems) {
  return !needsMemberThisWeek(items) && items.ownAsks.length === 0 && items.profileLines.length === 0;
}
