import { pickOnAccent } from "@/platform/design/accent";
import { escapeHtml, toSingleLine } from "@/platform/email/email-text";
import type { WeeklyEmailItem } from "@/platform/weekly-email/schema";
import { REPLY_CODES } from "@/platform/weekly-email/reply-codes";

import type { TodayItems } from "./today";

export const ITEM_ACTIONS = {
  ask: [REPLY_CODES.help, REPLY_CODES.skip],
  intro: [REPLY_CODES.yes, REPLY_CODES.no],
} as const;

const ACTION_LABELS: Record<string, string> = {
  [REPLY_CODES.help]: "I can help",
  [REPLY_CODES.skip]: "Not for me",
  [REPLY_CODES.yes]: "Yes, introduce",
  [REPLY_CODES.no]: "No thanks",
};

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
};

type Line = { text: string; html: string };

const TEXT_STYLE = "font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#0c2427";
const MUTED_STYLE = "font-size:14px;line-height:20px;color:#566463";

function firstName(name: string) {
  return toSingleLine(name).split(/\s+/)[0] || "there";
}

function quote(text: string) {
  return `“${toSingleLine(text)}”`;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function actionLinks(number: number, links: ItemLinks, accentColor: string): Line {
  const actions = [...(links.get(number) ?? new Map<string, string>())];
  return {
    text: actions.map(([action, url]) => `${ACTION_LABELS[action] ?? action}: ${url}`).join("\n   "),
    html: actions
      .map(
        ([action, url], index) =>
          `<a href="${escapeHtml(url)}" style="display:inline-block;margin:8px 8px 0 0;padding:8px 16px;border-radius:999px;font-size:14px;font-weight:700;text-decoration:none;${
            index === 0 ? `background:${accentColor};color:${pickOnAccent(accentColor)}` : "border:1px solid #c9d2d1;color:#0c2427"
          }">${escapeHtml(ACTION_LABELS[action] ?? action)}</a>`,
      )
      .join(""),
  };
}

function section(title: string, lines: Line[]): Line {
  return {
    text: [title, ...lines.map(({ text }) => text)].join("\n"),
    html: `<h2 style="font-size:18px;line-height:24px;margin:24px 0 8px">${escapeHtml(title)}</h2>${lines.map(({ html }) => html).join("")}`,
  };
}

function numberedLine(number: number, sentence: string, note: string | null, facts: WeeklyEmailFacts): Line {
  const links = actionLinks(number, facts.links, facts.accentColor);
  return {
    text: `${number}. ${sentence}${note ? `\n   ${note}` : ""}\n   ${links.text}`,
    html: `<div style="margin:0 0 16px"><p style="margin:0"><strong>${number}.</strong> ${escapeHtml(sentence)}</p>${
      note ? `<p style="margin:4px 0 0;${MUTED_STYLE}">${escapeHtml(note)}</p>` : ""
    }<div>${links.html}</div></div>`,
  };
}

function plainLine(sentence: string, url: string | null): Line {
  return {
    text: `- ${sentence}${url ? ` ${url}` : ""}`,
    html: `<p style="margin:0 0 8px">${url ? `<a href="${escapeHtml(url)}" style="color:#0c2427">${escapeHtml(sentence)}</a>` : escapeHtml(sentence)}</p>`,
  };
}

function numberFor(numbered: readonly WeeklyEmailItem[], ref: string) {
  return numbered.find((item) => item.ref === ref)?.number ?? null;
}

function buildSections(facts: WeeklyEmailFacts) {
  const { items, numbered, appUrl } = facts;
  const sections: Line[] = [];

  const askLines = items.helpableAsks.flatMap((ask) => {
    const number = numberFor(numbered, ask.id);
    if (number === null) return [];
    const why = `Why you: you said you can help with ${ask.matchedWords.join(", ")}.`;
    return [numberedLine(number, `${quote(ask.title)} from ${toSingleLine(ask.author.name)}.`, why, facts)];
  });
  if (askLines.length > 0) sections.push(section("Asks you could help with", askLines));

  const introLines = items.introsToAnswer.flatMap((intro) => {
    const number = numberFor(numbered, intro.id);
    if (number === null) return [];
    const sentence = `${toSingleLine(intro.requester.name)} asks you to introduce them to ${toSingleLine(intro.target.name)}.`;
    return [numberedLine(number, sentence, intro.note ? quote(intro.note) : null, facts)];
  });
  if (introLines.length > 0) sections.push(section("Intros waiting for your yes", introLines));

  if (items.introsToFinish.length > 0) {
    sections.push(
      section(
        "Ready for you to introduce",
        items.introsToFinish.map((intro) =>
          plainLine(`${toSingleLine(intro.target.name)} said yes to meeting ${toSingleLine(intro.requester.name)}. Send the intro.`, `${appUrl}/intros`),
        ),
      ),
    );
  }

  if (items.ownAsks.length > 0) {
    sections.push(
      section(
        "Your asks",
        items.ownAsks.map((ask) =>
          plainLine(`${quote(ask.title)}: ${ask.offers.length === 0 ? "no offers yet" : plural(ask.offers.length, "offer", "offers")}.`, `${appUrl}/asks`),
        ),
      ),
    );
  }

  if (items.newMemberCount > 0) {
    sections.push(
      section("New this week", [plainLine(`${plural(items.newMemberCount, "new member", "new members")} joined. Say hi.`, `${appUrl}/members`)]),
    );
  }
  return sections;
}

function replyHelp(facts: WeeklyEmailFacts): Line | null {
  if (!facts.canReply || facts.numbered.length === 0) return null;
  const first = facts.numbered[0];
  const example = first ? `${ITEM_ACTIONS[first.kind === "intro" ? "intro" : "ask"][0].toUpperCase()} ${first.number}` : "HELP 1";
  const sentence = `Or just reply: put a code on the first line, like ${example}, one per line. HELP, SKIP, YES and NO work. Words under HELP go to the asker.`;
  return { text: sentence, html: `<p style="margin:24px 0 0;${MUTED_STYLE}">${escapeHtml(sentence)}</p>` };
}

export function renderWeeklyEmail(facts: WeeklyEmailFacts) {
  const community = toSingleLine(facts.communityName);
  const count = facts.numbered.length;
  const subject = `${facts.isTest ? "[Test] " : ""}This week in ${community}${count > 0 ? `: ${plural(count, "thing", "things")} for you` : ""}`;
  const greeting = `Hi ${firstName(facts.memberName)}, here's what needs you this week.`;
  const built = buildSections(facts);
  const sections = built.length > 0 ? built : [plainLine("Nothing needs you this week.", null)];
  const help = replyHelp(facts);
  const closing = `That's everything this week. Open ${community}: ${facts.appUrl}`;

  const text = [greeting, ...sections.map(({ text: sectionText }) => sectionText), help?.text, closing].filter(Boolean).join("\n\n");
  const html = [
    `<div style="${TEXT_STYLE};max-width:520px;margin:0 auto;padding:24px">`,
    `<p style="margin:0 0 8px">${escapeHtml(greeting)}</p>`,
    ...sections.map(({ html: sectionHtml }) => sectionHtml),
    help?.html ?? "",
    `<p style="margin:24px 0 0">That's everything this week. <a href="${escapeHtml(facts.appUrl)}" style="color:#0c2427">Open ${escapeHtml(community)}</a></p>`,
    `</div>`,
  ].join("");
  return { subject, html, text };
}
