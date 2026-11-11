import { describeAnswerCount, describeCanHelp, toAskPage } from "@/modules/asks/contract";
import { INTRO_STATES } from "@/modules/intros/contract";
import { clipLine, describeEmailFoot, renderPlainTextHtml, toSingleLine } from "@/platform/email/email-text";
import { ROUTES } from "@/platform/http/routes";
import type { WeeklyEmailItem } from "@/platform/weekly-email/schema";
import { REPLY_CODES } from "@/platform/weekly-email/reply-codes";

import type { TodayItems } from "./today";

// The weekly digest, in Founderhall's words (copy/admin-digest-preview-sam.md, emails/email-digest-test.md). The
// plain text is the email; the HTML part shows the same lines, each "Label: link" line as a button.

export const ITEM_ACTIONS = {
  ask: [REPLY_CODES.help, REPLY_CODES.skip],
  intro: [REPLY_CODES.yes, REPLY_CODES.no],
} as const;

export type ItemLinks = ReadonlyMap<number, ReadonlyMap<string, string>>;

export type WeeklyEmailFacts = {
  memberName: string;
  communityName: string;
  accentColor: string;
  appUrl: string;
  items: TodayItems;
  numbered: readonly WeeklyEmailItem[];
  links: ItemLinks;
  canReply: boolean;
  isTest: boolean;
  // Where "Stop the weekly digest" goes: UNSUBSCRIBE_URL_MARK in a sent email (the outbox puts the member's own
  // unsubscribe page there), the app in a preview.
  stopUrl: string;
};

const CONSENT = "Nobody is introduced without saying yes.";
const ASK_LINE_LENGTH = 90;

function firstName(name: string) {
  return toSingleLine(name).split(/\s+/)[0] || "there";
}

function count(number: number, one: string, many: string) {
  return `${number} ${number === 1 ? one : many}`;
}

function numberFor(numbered: readonly WeeklyEmailItem[], ref: string) {
  return numbered.find((item) => item.ref === ref)?.number ?? null;
}

function linkOf(facts: WeeklyEmailFacts, number: number, action: string) {
  return facts.links.get(number)?.get(action) ?? `${facts.appUrl}${ROUTES.today}`;
}

// "Marcus Webb asks you to introduce them to Rachel Kim (CFO, Brightside Clinics)."
function describeIntroAsk(intro: TodayItems["introsToAnswer"][number]) {
  const about = intro.target.headline ? ` (${toSingleLine(intro.target.headline).replace(" at ", ", ")})` : "";
  return `${toSingleLine(intro.requester.name)} asks you to introduce them to ${toSingleLine(intro.target.name)}${about}.`;
}

// Founderhall's subject: what needs the member most, in their name.
function readSubject(first: string, help: number, intros: number, lines: number) {
  if (help) return `${first}, you could help with ${help === 1 ? "this one" : `these ${help}`}`;
  if (intros) return `${first}, ${intros === 1 ? "one intro is" : `${intros} intros are`} waiting for your yes`;
  if (lines) return `${first}, is this right?`;
  return `${first}, that’s everything this week`;
}

function readMineLines({ items, appUrl }: WeeklyEmailFacts) {
  return [
    ...items.ownPosts.map(
      (post) =>
        `“${clipLine(post.body, ASK_LINE_LENGTH)}”: ${post.helperCount ? describeCanHelp(post.helperCount) : "no paths found yet"}, ${describeAnswerCount(post.answerCount)}. ${appUrl}${toAskPage(post.id)}`,
    ),
    ...items.introsInMotion.map((intro) => {
      const via = firstName(intro.introducer.name);
      const withWhom = intro.state === INTRO_STATES.requested ? via : firstName(intro.target.name);
      return `Your intro to ${toSingleLine(intro.target.name)} via ${via}: with ${withWhom}. ${appUrl}${ROUTES.intros}/${intro.id}`;
    }),
  ];
}

// Founderhall's Thursday digest (digestEmail), word for word, as plain text. Asks you could help with, intros waiting
// for your yes and lines on your profile are numbered, each with its links and, when replies work, its reply codes.
export function renderWeeklyEmail(facts: WeeklyEmailFacts) {
  const { items, numbered, canReply, appUrl } = facts;
  const community = toSingleLine(facts.communityName);
  const first = firstName(facts.memberName);
  const help = items.helpableAsks.flatMap((ask) => {
    const number = numberFor(numbered, ask.id);
    return number === null ? [] : [{ ask, number }];
  });
  const intros = items.introsToAnswer.flatMap((intro) => {
    const number = numberFor(numbered, intro.id);
    return number === null ? [] : [{ intro, number }];
  });
  const lastNumber = Math.max(0, ...numbered.map(({ number }) => number));
  const lines = items.profileLines.map((line, index) => ({ line, number: lastNumber + index + 1 }));
  const summary = [
    help.length ? count(help.length, "ask you could help with", "asks you could help with") : null,
    intros.length ? count(intros.length, "intro waiting for your yes", "intros waiting for your yes") : null,
    lines.length ? count(lines.length, "line on your profile to check", "lines on your profile to check") : null,
  ].filter(Boolean);

  const parts: string[] = [`Hi ${first},`, ""];
  if (facts.isTest) parts.push("(A test digest: it went only to you. Its links and reply codes work, because they are your own items.)", "");
  parts.push(summary.length ? `Your week at ${community}: ${summary.join(", ")}.` : `Nothing needs you at ${community} this week.`);
  if (summary.length) parts.push(canReply ? "Answer any item from your inbox: reply with its code on the first line (for example HELP 1), or use its link." : "Answer any item with its link.");
  if (help.length) {
    parts.push("", `YOU COULD HELP WITH ${help.length === 1 ? "THIS ONE" : `THESE ${help.length}`}`);
    for (const { ask, number } of help) {
      const author = toSingleLine(ask.author.name);
      parts.push("", `${number}. ${author} asks: ${toSingleLine(ask.title)}`);
      if (ask.who) parts.push(`   Trying to reach: ${ask.who}`);
      parts.push(`   Why you: ${ask.whyYou}`);
      parts.push(`   I can help: ${linkOf(facts, number, REPLY_CODES.help)}`, `   Not this week: ${linkOf(facts, number, REPLY_CODES.skip)}`);
      if (canReply) parts.push(`   Or reply HELP ${number} with a line for ${firstName(author)} · SKIP ${number}`);
    }
  }
  if (intros.length) {
    parts.push("", `INTRO${intros.length === 1 ? "" : "S"} WAITING FOR YOUR YES`);
    for (const { intro, number } of intros) {
      parts.push("", `${number}. ${describeIntroAsk(intro)}`);
      parts.push(`   Yes: ${linkOf(facts, number, REPLY_CODES.yes)}`, `   Not this time: ${linkOf(facts, number, REPLY_CODES.no)}`);
      if (canReply) parts.push(`   Or reply YES ${number} · NO ${number}`);
    }
  }
  if (lines.length) {
    parts.push("", "IS THIS RIGHT? WE FILLED THIS IN FROM PUBLIC SOURCES");
    for (const { line, number } of lines) {
      const link = `${appUrl}${ROUTES.today}#fact-${line.field}`;
      parts.push("", `${number}. ${line.label}: ${line.value}`, `   Right: ${link}`, `   Hide it: ${link}`, `   Fix it: ${link}`);
    }
  }
  const mine = readMineLines(facts);
  if (mine.length) {
    parts.push("", "YOUR ASKS IN MOTION");
    for (const line of mine) parts.push(`- ${line}`);
  }
  parts.push("", `That’s everything this week. Open the portal: ${appUrl}${ROUTES.today}`, "", CONSENT, "", `Stop the weekly digest: ${facts.stopUrl}`, "", describeEmailFoot(community));

  const subject = readSubject(first, help.length, intros.length, lines.length);
  const text = parts.join("\n");
  return { subject: facts.isTest ? `[Test] ${subject}` : subject, html: renderPlainTextHtml(text), text };
}
