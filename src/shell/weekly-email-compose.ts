import { describeWhyYou } from "@/modules/asks/contract-today";
import { escapeHtml, toSingleLine } from "@/platform/email/email-text";
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
  // Where "Stop the weekly digest" goes: UNSUBSCRIBE_LINK in a sent email, the app in a preview.
  stopUrl: string;
};

// Founderhall's two closing lines.
export const DIGEST_CONSENT = "Nobody is introduced without saying yes.";
export const DIGEST_TEST_LINE = "(A test digest: it went only to you. Its links and reply codes work, because they are your own items.)";

const MAX_QUOTE = 90;

function firstName(name: string) {
  return toSingleLine(name).split(/\s+/)[0] || "there";
}

function clip(text: string, length: number) {
  const line = toSingleLine(text);
  return line.length > length ? `${line.slice(0, length - 1).trimEnd()}…` : line;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function numberFor(numbered: readonly WeeklyEmailItem[], ref: string) {
  return numbered.find((item) => item.ref === ref)?.number ?? null;
}

function linkFor(links: ItemLinks, number: number, action: string, fallback: string) {
  return links.get(number)?.get(action) ?? fallback;
}

function readSubject(facts: WeeklyEmailFacts, helpCount: number, introCount: number) {
  const name = firstName(facts.memberName);
  const subject = helpCount
    ? `${name}, you could help with ${helpCount === 1 ? "this one" : `these ${helpCount}`}`
    : introCount
      ? `${name}, ${introCount === 1 ? "one intro is" : `${introCount} intros are`} waiting for your yes`
      : `${name}, that’s everything this week`;
  return facts.isTest ? `[Test] ${subject}` : subject;
}

export function renderWeeklyEmailText(facts: WeeklyEmailFacts) {
  const { items, numbered, links, appUrl, canReply } = facts;
  const community = toSingleLine(facts.communityName);
  const asks = items.helpableAsks.flatMap((ask) => {
    const number = numberFor(numbered, ask.id);
    return number === null ? [] : [{ ask, number }];
  });
  const intros = items.introsToAnswer.flatMap((intro) => {
    const number = numberFor(numbered, intro.id);
    return number === null ? [] : [{ intro, number }];
  });
  const summary = [
    asks.length ? plural(asks.length, "ask") + " you could help with" : null,
    intros.length ? plural(intros.length, "intro") + " waiting for your yes" : null,
  ].filter((part) => part !== null);

  const lines: string[] = [`Hi ${firstName(facts.memberName)},`, ""];
  if (facts.isTest) lines.push(DIGEST_TEST_LINE, "");
  lines.push(summary.length ? `Your week at ${community}: ${summary.join(", ")}.` : `Nothing needs you at ${community} this week.`);
  if (summary.length) {
    lines.push(canReply ? "Answer any item from your inbox: reply with its code on the first line (for example HELP 1), or use its link." : "Answer any item by its link.");
  }

  if (asks.length) {
    lines.push("", `YOU COULD HELP WITH ${asks.length === 1 ? "THIS ONE" : `THESE ${asks.length}`}`);
    for (const { ask, number } of asks) {
      lines.push("", `${number}. ${toSingleLine(ask.author.name)} asks: ${toSingleLine(ask.title)}`);
      const why = describeWhyYou(ask).replace(/[.!?]+$/u, "");
      if (why) lines.push(`   Why you: ${why}.`);
      lines.push(`   I can help: ${linkFor(links, number, REPLY_CODES.help, appUrl)}`, `   Not this week: ${linkFor(links, number, REPLY_CODES.skip, appUrl)}`);
      if (canReply) lines.push(`   Or reply HELP ${number} with a line for ${firstName(ask.author.name)} · SKIP ${number}`);
    }
  }

  if (intros.length) {
    lines.push("", `INTRO${intros.length === 1 ? "" : "S"} WAITING FOR YOUR YES`);
    for (const { intro, number } of intros) {
      const isConnector = intro.viewerRole === "introducer";
      const line = isConnector
        ? `${toSingleLine(intro.requester.name)} asks you to introduce them to ${toSingleLine(intro.target.name)}.`
        : `${toSingleLine(intro.introducer.name)} would like to introduce you to ${toSingleLine(intro.requester.name)}.`;
      lines.push("", `${number}. ${line}`);
      lines.push(`   Yes: ${linkFor(links, number, REPLY_CODES.yes, appUrl)}`, `   ${isConnector ? "Not this time" : "No thanks"}: ${linkFor(links, number, REPLY_CODES.no, appUrl)}`);
      if (canReply) lines.push(`   Or reply YES ${number} · NO ${number}`);
    }
  }

  // Community's own: intros both said yes to, waiting for the connector to make them.
  if (items.introsToFinish.length) {
    lines.push("", "READY FOR YOU TO INTRODUCE");
    for (const intro of items.introsToFinish) {
      lines.push(`- ${toSingleLine(intro.target.name)} said yes to meeting ${toSingleLine(intro.requester.name)}. Send the intro: ${appUrl}/intros/${intro.id}`);
    }
  }

  if (items.ownAsks.length) {
    lines.push("", "YOUR ASKS IN MOTION");
    for (const ask of items.ownAsks) {
      const helpers = ask.helpers.length ? `${plural(ask.helpers.length, "member")} can help` : "no paths found yet";
      lines.push(`- “${clip(ask.title, MAX_QUOTE)}”: ${helpers}, ${plural(ask.answers.length, "answer")}. ${appUrl}/asks/${ask.id}`);
    }
  }

  if (items.newMemberCount > 0) {
    lines.push("", "NEW THIS WEEK", `- ${plural(items.newMemberCount, "new member")} joined. Say hi: ${appUrl}/members`);
  }

  lines.push("", `That’s everything this week. Open the portal: ${appUrl}`, "", DIGEST_CONSENT, "", `Stop the weekly digest: ${facts.stopUrl}`, "", `Sent by ${community} via its member portal.`);
  return { subject: readSubject(facts, asks.length, intros.length), text: lines.join("\n") };
}

// "   I can help: https://…" (or the stop line's UNSUBSCRIBE_LINK) → its label and link; "… Open the portal: https://…" → the words before and the link.
const LABELLED_LINK = /^(\s*)(.*?):\s+(https?:\/\/\S+|\{\{unsubscribe_link\}\})\s*$/u;

function renderHtmlLine(line: string, accentColor: string) {
  const labelled = line.match(LABELLED_LINK);
  if (!labelled) return `<div style="white-space:pre-wrap;min-height:21px">${line ? escapeHtml(line) : "&nbsp;"}</div>`;
  const [, indent = "", label = "", url = ""] = labelled;
  const cut = label.lastIndexOf(". ");
  const before = cut >= 0 ? `${label.slice(0, cut + 1)} ` : "";
  const button = cut >= 0 ? label.slice(cut + 2) : label;
  const style = `display:inline-block;margin:3px 0;padding:4px 12px;border:1px solid ${accentColor};border-radius:6px;color:${accentColor};font-weight:600;font-size:13px;text-decoration:none`;
  return `<div style="white-space:pre-wrap;min-height:21px">${escapeHtml(indent)}${escapeHtml(before)}<a href="${escapeHtml(url)}" style="${style}">${escapeHtml(button)}</a></div>`;
}

export function renderWeeklyEmail(facts: WeeklyEmailFacts) {
  const { subject, text } = renderWeeklyEmailText(facts);
  const accent = facts.accentColor;
  const html = [
    `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:21px;color:#1B2420;max-width:560px;margin:0 auto;padding:24px">`,
    ...text.split("\n").map((line) => renderHtmlLine(line, accent)),
    `</div>`,
  ].join("");
  return { subject, html, text };
}
