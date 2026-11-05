import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { removeBidiControls } from "../../platform/text/safe-text.ts";
import { toLinkedinUrl } from "../members/contract-linkedin.ts";
import type { Intro } from "./contract.ts";

export function readIntroPromise(introducerName: string, targetName: string) {
  return `${readFirstName(introducerName)} reads your note first. ${readFirstName(targetName)} hears nothing unless they say yes.`;
}

export function readConsentPromise(targetName: string) {
  return `You're only introduced if ${readFirstName(targetName)} says yes too.`;
}

export function readNoteSharingLine(introducerName: string, targetName: string) {
  return `If ${readFirstName(introducerName)} says yes, ${readFirstName(targetName)} sees your name, your role and your note, then decides.`;
}

export function composeStarterNote(introducerName: string, targetName: string) {
  return `Hi ${readFirstName(introducerName)},\n\nWould you be open to introducing me to ${readFirstName(targetName)}? Here's why I'd like to meet them:\n\n`;
}

export function readWhyTheyWrote(note: string, introducerName: string, targetName: string) {
  const starter = composeStarterNote(introducerName, targetName).trim();
  if (!note.startsWith(starter)) return note;
  return note.slice(starter.length).trim() || note;
}

type BlurbFacts = Pick<Intro, "requester" | "introducer" | "target" | "note">;

function readRequesterLine({ name, headline }: Intro["requester"]) {
  return headline ? `${name} (${headline})` : name;
}

function readLinkedinLine({ linkedinSlug }: Intro["requester"]) {
  return linkedinSlug ? `\n\nTheir LinkedIn: ${toLinkedinUrl(linkedinSlug)}` : "";
}

export function composeForwardableBlurb({ requester, introducer, target, note }: BlurbFacts) {
  const blurb = [
    `Hi ${readFirstName(target.name)},`,
    `${readRequesterLine(requester)} asked me for an intro to you, and I wanted to check with you first.`,
    `Here's what they wrote:\n\n${readWhyTheyWrote(note, introducer.name, target.name)}${readLinkedinLine(requester)}`,
    "Would you like me to connect you? If not, no problem at all.",
  ].join("\n\n");
  return removeBidiControls(blurb);
}

export function composeConsentNote({ requester, introducer, target, note }: BlurbFacts, consentLink: string) {
  const blurb = [
    `Hi ${readFirstName(target.name)},`,
    `${readRequesterLine(requester)} asked me for an intro to you, and I wanted to check with you first.`,
    `Here's what they wrote:\n\n${readWhyTheyWrote(note, introducer.name, target.name)}${readLinkedinLine(requester)}`,
    `You can say yes or no thanks here. It takes a few seconds, and you don't need an account:\n${consentLink}`,
    `Either answer is fine. If it's a no, ${readFirstName(requester.name)} won't hear who said it.`,
  ].join("\n\n");
  return removeBidiControls(blurb);
}

export function composeJoiningMessage({ requester, introducer, target, note }: BlurbFacts) {
  const requesterFirst = readFirstName(requester.name);
  const targetFirst = readFirstName(target.name);
  const message = [
    `${targetFirst}, meet ${requesterFirst}. ${requesterFirst}, meet ${targetFirst}.`,
    `${targetFirst}, you said yes to this intro. Here's what ${readRequesterLine(requester)} wrote:\n\n${readWhyTheyWrote(note, introducer.name, target.name)}`,
    "I'll let you two take it from here.",
  ].join("\n\n");
  return removeBidiControls(message);
}
