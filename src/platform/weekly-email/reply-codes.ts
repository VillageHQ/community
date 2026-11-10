export const REPLY_CODES = { help: "help", skip: "skip", yes: "yes", no: "no" } as const;

export type ReplyCode = (typeof REPLY_CODES)[keyof typeof REPLY_CODES];

export type ParsedCode = { code: ReplyCode; itemNumber: number; words: string };

const CODE_PATTERN = /^\s*(help|skip|yes|no)\s*#?\s*(\d{1,3})\b[\s:.,!-]*(.*)$/i;
const MAXIMUM_CODES = 20;

// Where the quoted history starts in common mail apps. Everything from there on is the old email.
const QUOTE_STARTS = [
  /\n[ \t]*On [^\n]*(?:\n[^\n]*)?\bwrote:[ \t]*(?:\n|$)/,
  /\n[ \t]*-{2,}[ \t]*Original Message[ \t]*-{2,}/i,
  /\n[ \t]*_{8,}[ \t]*\n/,
  /\n[ \t]*From:[^\n]+\n[ \t]*(?:Sent|Date):/i,
  /\n-- ?\n/,
  /\n[ \t]*Sent from my [^\n]+/i,
  /\n>/,
];

export function stripQuotedReply(text: string) {
  let reply = `\n${text.replace(/\r\n/g, "\n")}`;
  for (const pattern of QUOTE_STARTS) {
    const match = pattern.exec(reply);
    if (match) reply = reply.slice(0, match.index);
  }
  return reply.trim();
}

function isReplyCode(value: string): value is ReplyCode {
  return Object.values<string>(REPLY_CODES).includes(value);
}

// Reads the codes at the top of a reply, one per line, like "HELP 1" or "NO 2". The first line that
// isn't a code ends the list. Words after a code on its line, or below the codes, go with it.
export function parseReplyCodes(text: string): ParsedCode[] {
  const lines = stripQuotedReply(text).split("\n");
  let index = 0;
  while (index < lines.length && !lines[index]?.trim()) index += 1;
  const codes: { code: ReplyCode; itemNumber: number; rest: string }[] = [];
  for (; index < lines.length && codes.length < MAXIMUM_CODES; index += 1) {
    const match = CODE_PATTERN.exec(lines[index] ?? "");
    const code = match?.[1]?.toLowerCase();
    if (!match || !code || !isReplyCode(code)) break;
    codes.push({ code, itemNumber: Number(match[2]), rest: (match[3] ?? "").trim() });
  }
  const below = lines.slice(index).join("\n").trim();
  return codes.map(({ code, itemNumber, rest }) => ({ code, itemNumber, words: rest || below }));
}

const ADDRESS_IN_BRACKETS = /<([^<>\s]+@[^<>\s]+)>/;
const BARE_ADDRESS = /[^\s<>"',;]+@[^\s<>"',;]+/;

export function readEmailAddress(value: string) {
  const address = ADDRESS_IN_BRACKETS.exec(value)?.[1] ?? BARE_ADDRESS.exec(value)?.[0] ?? "";
  return address.trim().toLowerCase();
}
