import { readFirstName } from "../design/avatar-identity.ts";
import { removeBidiControls } from "../safe-text.ts";
import { toLinkedinUrl } from "../village/linkedin-slug.ts";
import type { Intro } from "./intro-api.ts";

export function readIntroPromise(introducerName: string, targetName: string) {
  return `${readFirstName(introducerName)} reads your note first. ${readFirstName(targetName)} hears nothing unless they say yes.`;
}

export function readNoteSharingLine(introducerName: string, targetName: string) {
  return `If ${readFirstName(introducerName)} says yes, they may pass your note on to ${readFirstName(targetName)}.`;
}

export function composeStarterNote(introducerName: string, targetName: string) {
  return `Hi ${readFirstName(introducerName)},\n\nWould you be open to introducing me to ${readFirstName(targetName)}? Here's why I'd like to meet them:\n\n`;
}

function readWhyTheyWrote(note: string, introducerName: string, targetName: string) {
  const starter = composeStarterNote(introducerName, targetName).trim();
  if (!note.startsWith(starter)) return note;
  return note.slice(starter.length).trim() || note;
}

type BlurbFacts = Pick<Intro, "requester" | "introducer" | "target" | "note">;

export function composeForwardableBlurb({ requester, introducer, target, note }: BlurbFacts) {
  const requesterLine = requester.headline ? `${requester.name} (${requester.headline})` : requester.name;
  const linkedinLine = requester.linkedinSlug ? `\n\nTheir LinkedIn: ${toLinkedinUrl(requester.linkedinSlug)}` : "";
  const blurb = [
    `Hi ${readFirstName(target.name)},`,
    `${requesterLine} asked me for an intro to you, and I wanted to check with you first.`,
    `Here's what they wrote:\n\n${readWhyTheyWrote(note, introducer.name, target.name)}${linkedinLine}`,
    "Would you like me to connect you? If not, no problem at all.",
  ].join("\n\n");
  return removeBidiControls(blurb);
}
