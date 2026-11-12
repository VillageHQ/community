import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { escapeHtml, toSingleLine } from "../../platform/email/email-text.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";

// The words of every intro email, copied from Founderhall (plain text, brief, consent said out loud). Each returns
// { subject, text, html }; the html is the same text, line for line, with its links clickable.

const first = (name: string) => toSingleLine(readFirstName(removeBidiControls(name)));
const one = (value: string) => toSingleLine(removeBidiControls(value));

// "Sam's", "Marcus'", "Northwind Founders’": an apostrophe alone after an s. Screens pass "’"; emails keep "'".
export function possessive(name: string, apostrophe = "'") {
  const trimmed = name.trim();
  return /s$/i.test(trimmed) ? `${trimmed}${apostrophe}` : `${trimmed}${apostrophe}s`;
}

// Founderhall writes "role, company"; Village's headlines say "role at company".
export function toRoleAndCompany(headline: string | null) {
  const trimmed = headline?.trim() ?? "";
  const atIndex = trimmed.lastIndexOf(" at ");
  return atIndex > 0 ? `${trimmed.slice(0, atIndex)}, ${trimmed.slice(atIndex + " at ".length)}` : trimmed || null;
}

export function emailFoot(community: string) {
  return `Sent by ${one(community)} via its member portal.`;
}

function quote(note: string) {
  return removeBidiControls(note)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function withAbout(name: string, about: string | null) {
  return about ? `${one(name)} (${one(about)})` : one(name);
}

const LINK_PATTERN = /(https?:\/\/[^\s]+)/g;

// The text as html: one block that keeps its lines, each link clickable.
export function renderPlainHtml(text: string) {
  const parts = text.split(LINK_PATTERN).map((part, index) => (index % 2 === 1 ? `<a href="${escapeHtml(part)}">${escapeHtml(part)}</a>` : escapeHtml(part)));
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:22px;color:#1b2420;max-width:600px;white-space:pre-wrap">${parts.join("")}</div>`;
}

function email(subject: string, lines: readonly string[]) {
  const text = lines.join("\n");
  return { subject, text, html: renderPlainHtml(text) };
}

type ConnectorAskFacts = {
  community: string;
  asker: string;
  askerAbout: string | null;
  connector: string;
  target: string;
  targetAbout: string | null;
  note: string;
  links: { yes: string; notNow: string; dontKnow: string };
  // Replies by email are on, so the connector may answer YES or NO by replying.
  canReply: boolean;
  isReminder?: boolean;
};

export function renderConnectorAsk({ community, asker, askerAbout, connector, target, targetAbout, note, links, canReply, isReminder = false }: ConnectorAskFacts) {
  const subject = `${isReminder ? "Reminder: " : ""}${first(connector)}, would you introduce ${one(asker)} to ${one(target)}?`;
  const opening = isReminder
    ? `A reminder, in case this got buried. ${first(asker)} asked a few days ago:`
    : `${withAbout(asker, askerAbout)} asked ${one(community)} for an intro to ${withAbout(target, targetAbout)}, through you.`;
  return email(subject, [
    `Hi ${first(connector)},`,
    "",
    opening,
    "",
    `${possessive(first(asker))} note, written so you can forward it:`,
    "",
    quote(note),
    "",
    "Would you introduce them?",
    "",
    `Yes, introduce them: ${links.yes}`,
    `Not this time: ${links.notNow}`,
    `I don't know them well enough: ${links.dontKnow}`,
    "",
    ...(canReply
      ? [
          `Or reply to this email with YES or NO on the first line. With a yes, put ${possessive(first(target))} email on the next line: we email ${first(target)} once, from ${one(community)}, and introduce you only if ${first(target)} says yes too.`,
          "",
        ]
      : []),
    `If you say no, ${first(asker)} is told you can't make this one, never why. Nobody is introduced without saying yes.`,
    "",
    emailFoot(community),
  ]);
}

type TargetAskFacts = {
  community: string;
  connector: string;
  asker: string;
  askerAbout: string | null;
  target: string;
  note: string;
  links: { yes: string; no: string };
  optOutLink: string;
  isReminder?: boolean;
};

export function renderTargetAsk({ community, connector, asker, askerAbout, target, note, links, optOutLink, isReminder = false }: TargetAskFacts) {
  return email(`${isReminder ? "Reminder: " : ""}${one(connector)} would like to introduce you to ${one(asker)}`, [
    `Hi ${first(target)},`,
    "",
    isReminder
      ? `A reminder, in case this got buried. ${first(connector)} asked a few days ago:`
      : `${one(connector)}, a member of ${one(community)}, thinks you and ${withAbout(asker, askerAbout)} should meet.`,
    "",
    `${possessive(first(asker))} note:`,
    "",
    quote(note),
    "",
    `Yes, introduce us: ${links.yes}`,
    `No thanks: ${links.no}`,
    "",
    `Or reply YES or NO on the first line. If you say yes, we send one email to you and ${first(asker)}, with ${first(connector)} copied. If you say no, nobody is told why${isReminder ? "" : ", and this is the only email you get about it (one reminder at most)"}.`,
    "",
    `Don't send me intro asks from ${one(community)}: ${optOutLink}`,
    "",
    emailFoot(community),
  ]);
}

export function introductionSubject(asker: string, target: string, connector: string) {
  return `${first(asker)} ↔ ${first(target)}, via ${first(connector)}`;
}

// Who this copy of the introduction is for. "both": one email to the asker and the person, when replies by email are
// off (they reply all).
export type IntroductionReader = "asker" | "target" | "connector" | "both";

type IntroductionFacts = {
  community: string;
  asker: string;
  askerAbout: string | null;
  target: string;
  targetAbout: string | null;
  connector: string;
  // Null hides the address (members never see each other's address: the connector's copy).
  askerEmail: string | null;
  targetEmail: string | null;
  note: string;
};

function replyLine(reader: IntroductionReader, asker: string, target: string, connector: string) {
  if (reader === "both") return "Reply all to write to each other.";
  if (reader === "connector") return "Reply to this email to write to both of them; replies also show in the portal. Or write to each other directly.";
  const other = reader === "asker" ? first(target) : first(asker);
  return `Reply to this email to write to ${other} (${first(connector)} is copied); replies also show in the portal. Or write to each other directly.`;
}

export function renderIntroduction({ community, asker, askerAbout, target, targetAbout, connector, askerEmail, targetEmail, note }: IntroductionFacts, reader: IntroductionReader) {
  const contact = (name: string, about: string | null, address: string | null) => `${withAbout(name, about)}${address ? `: ${address}` : ""}`;
  return email(introductionSubject(asker, target, connector), [
    `${first(asker)}, meet ${first(target)}. ${first(target)}, meet ${first(asker)}.`,
    "",
    `${one(connector)} introduced you through ${one(community)}, and you both said yes.`,
    "",
    contact(asker, askerAbout, askerEmail),
    contact(target, targetAbout, targetEmail),
    "",
    `${possessive(first(asker))} note:`,
    "",
    quote(note),
    "",
    replyLine(reader, asker, target, connector),
    "",
    emailFoot(community),
  ]);
}

type AskEndedFacts = { community: string; asker: string; who: string; target: string; allowanceLeft: string | null; findLink: string; isExpired: boolean };

// To the asker when an ask ends without an intro. Kind, and never the reason.
export function renderAskEnded({ community, asker, who, target, allowanceLeft, findLink, isExpired }: AskEndedFacts) {
  return email(isExpired ? `No answer on your intro to ${first(target)}` : `${one(who)} can't make this one`, [
    `Hi ${first(asker)},`,
    "",
    isExpired
      ? `Your ask for an intro to ${one(target)} had no answer in 7 days, so it has closed.`
      : `${one(who)} can't make the intro to ${one(target)}. That happens; it says nothing about your ask.`,
    "",
    ...(allowanceLeft ? [`Your ask is back: you have ${allowanceLeft}.`] : ["Your ask is back."]),
    `Find another way in: ${findLink}`,
    "",
    emailFoot(community),
  ]);
}

export const CONNECTOR_UPDATES = { withdrawn: "withdrawn", declined: "declined", expired: "expired" } as const;

export type ConnectorUpdate = (typeof CONNECTOR_UPDATES)[keyof typeof CONNECTOR_UPDATES];

export function renderConnectorUpdate({ community, connector, asker, target, kind }: { community: string; connector: string; asker: string; target: string; kind: ConnectorUpdate }) {
  const what = {
    [CONNECTOR_UPDATES.withdrawn]: `${one(asker)} withdrew the ask for an intro to ${one(target)}. There is nothing more to do.`,
    [CONNECTOR_UPDATES.expired]: `${one(target)} didn't answer the intro ask in 7 days, so it has closed. Nothing more is sent to ${first(target)}.`,
    [CONNECTOR_UPDATES.declined]: `${one(target)} can't take the intro to ${one(asker)} right now. Thank you for asking.`,
  }[kind];
  return email(`Intro to ${one(target)}: closed`, [`Hi ${first(connector)},`, "", what, "", emailFoot(community)]);
}

const DAYS_AGO_WORDS: Record<number, string> = { 7: "A week ago", 14: "Two weeks ago", 21: "Three weeks ago", 28: "Four weeks ago" };

type OutcomeQuestionFacts = {
  community: string;
  asker: string;
  target: string;
  connector: string;
  links: { helpful: string; notReally: string; tooEarly: string };
  daysAgo: number;
  isReminder?: boolean;
};

export function renderOutcomeQuestion({ community, asker, target, connector, links, daysAgo, isReminder = false }: OutcomeQuestionFacts) {
  const ago = DAYS_AGO_WORDS[daysAgo] ?? `${daysAgo} days ago`;
  return email(`${isReminder ? "Reminder: w" : "W"}as the intro to ${first(target)} helpful?`, [
    `Hi ${first(asker)},`,
    "",
    `${ago} ${one(connector)} introduced you to ${one(target)}. Was it helpful?`,
    "",
    `Yes: ${links.helpful}`,
    `Not really: ${links.notReally}`,
    `Too early to say: ${links.tooEarly}`,
    "",
    "The page also asks what came of it: a customer conversation, a hire, an investor meeting, or nothing yet.",
    "",
    `One click. ${one(community)} counts the answers, never the details; ${first(connector)} gets a thank-you if it helped.`,
    "",
    emailFoot(community),
  ]);
}

export function renderThanksToConnector({ community, connector, asker, target }: { community: string; connector: string; asker: string; target: string }) {
  return email(`${first(asker)} found your intro helpful`, [
    `Hi ${first(connector)},`,
    "",
    `${one(asker)} said your intro to ${one(target)} was helpful. Thank you.`,
    "",
    emailFoot(community),
  ]);
}
