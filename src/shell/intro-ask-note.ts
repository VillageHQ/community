// The forwardable note, drafted from the asker's own profile (Founderhall's intros/flow.mjs draftNote and shortNote).
// The asker changes anything before it goes.

export type AskerProfile = { name: string; title: string | null; company: string | null; bio: string | null; needs: string | null };

export const NOTE_MAXIMUM = 700;

function readFirst(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

function readFirstSentence(text: string | null) {
  return (text ?? "").trim().split(/(?<=[.!?])\s/)[0]?.replace(/[.!]$/, "") ?? "";
}

function readRoleAt({ title, company }: Pick<AskerProfile, "title" | "company">) {
  return [title, company].filter(Boolean).join(" at ");
}

// One paragraph for the one-step ask from search: "I’m Sam, Co-founder & CEO at Tallyhealth. Prior-authorisation
// automation for outpatient clinics. An intro to procurement at a US hospital group. Could you introduce me to Rosa at
// Halcyon Health?"
export function draftShortNote(asker: AskerProfile, { targetName, targetCompany }: { targetName: string; targetCompany: string | null }) {
  const ask = `Could you introduce me to ${readFirst(targetName) || "them"}${targetCompany ? ` at ${targetCompany}` : ""}?`;
  const roleAt = readRoleAt(asker);
  const work = readFirstSentence(asker.bio);
  const what = !work ? "" : /^(a|an|the)\s/i.test(work) ? `: ${work.charAt(0).toLowerCase()}${work.slice(1)}` : `. ${work}`;
  const want = readFirstSentence(asker.needs);
  return [`I’m ${readFirst(asker.name)}${roleAt ? `, ${roleAt}` : ""}${what}.`, want ? `${want}.` : "", ask]
    .filter(Boolean)
    .join(" ")
    .slice(0, NOTE_MAXIMUM);
}

export type NoteParts = { who: string; why: string; proof: string };

// The three parts of the note from a profile: who I am and what I do, why this person, why now; one proof point.
export function draftNoteParts(asker: AskerProfile, { targetName, targetCompany }: { targetName: string; targetCompany: string | null }): NoteParts {
  const roleAt = readRoleAt(asker);
  const work = (asker.bio ?? "").trim();
  const who = `I’m ${readFirst(asker.name)}${roleAt ? `, ${roleAt}` : ""}.${work ? ` ${work}` : ""}`;
  const targetFirst = readFirst(targetName) || "them";
  const needs = (asker.needs ?? "").trim().replace(/\.$/, "");
  const why = needs
    ? `${needs}. I’d value 20 minutes with ${targetFirst}${targetCompany ? ` on how ${targetCompany} decides` : ""}.`
    : `I’d value 20 minutes with ${targetFirst}${targetCompany ? ` about ${targetCompany}` : ""}.`;
  return { who, why, proof: "" };
}

export function joinNoteParts({ who, why, proof }: NoteParts) {
  return [who, why, proof].map((part) => part.trim()).filter(Boolean).join("\n\n");
}
