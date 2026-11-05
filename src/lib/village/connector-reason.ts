import { readFirstName } from "../../platform/design/avatar-identity.ts";
import { removeBidiControls, removeNullBytes } from "../../platform/text/safe-text.ts";

type ScoreMeta = { title?: string | null; description?: string | null };

const MAXIMUM_REASONS = 2;
const LAST_PRIORITY = 99;
const PICTOGRAPHS = /\p{Extended_Pictographic}️?\s*/gu;
const EMPLOYEE_COUNT = /\s*\([\d,\s\-+–]*employees\)/gi;
const EMPTY_ROLES = /[.!]?\s*\S+ as\s+while\s+\S+ as\s*\S*\s*$/i;
const TRAILING_EMPTY_ROLE = /\s+while\s+\S+ as\s*$/i;
const LEADING_EMPTY_ROLE = /\.\s*\S+ as\s+while\s+/i;
const VIA_PARENTHETICAL = /\s*\(via [^)]*\)\s*$/i;
const ENDS_WITH_PUNCTUATION = /[.!?]$/;
const NOT_A_REASON = /direct connection|community member/i;

const REASON_PRIORITY: Record<string, number> = {
  Work: 0,
  "Verified interactions": 1,
  Investment: 2,
  Manual: 3,
  Community: 4,
  LinkedIn: 5,
};

export function cleanVillageText(text: string, maximumLength: number) {
  return removeBidiControls(removeNullBytes(text)).replace(PICTOGRAPHS, "").trim().slice(0, maximumLength);
}

function toPlainSentence(description: string, maximumLength: number) {
  const plain = cleanVillageText(description, maximumLength)
    .replace(EMPLOYEE_COUNT, "")
    .replace(EMPTY_ROLES, "")
    .replace(TRAILING_EMPTY_ROLE, "")
    .replace(LEADING_EMPTY_ROLE, ". ")
    .trim();
  if (!plain) return "";
  return ENDS_WITH_PUNCTUATION.test(plain) ? plain : `${plain}.`;
}

function readPriority({ title }: ScoreMeta) {
  return REASON_PRIORITY[title ?? ""] ?? LAST_PRIORITY;
}

export function readScoreMetaReason(scoreMeta: readonly ScoreMeta[] | null | undefined, maximumLength: number) {
  const sentences = (scoreMeta ?? [])
    .toSorted((first, second) => readPriority(first) - readPriority(second))
    .map(({ description }) => toPlainSentence(description ?? "", maximumLength))
    .filter(Boolean)
    .slice(0, MAXIMUM_REASONS);
  return sentences.join(" ").slice(0, maximumLength);
}

export function readSummaryReason(description: string | null | undefined, maximumLength: number) {
  if (!description || NOT_A_REASON.test(description)) return "";
  return toPlainSentence(description.replace(VIA_PARENTHETICAL, ""), maximumLength);
}

export function readUnexplainedReason(connectorName: string, targetName: string | null) {
  const target = targetName ? readFirstName(targetName) : "this person";
  return removeBidiControls(`Village sees a connection between ${readFirstName(connectorName)} and ${target}, but didn't say how they know each other.`);
}

export function readThroughReason(connectorName: string, throughName: string, targetName: string | null) {
  const target = targetName ? readFirstName(targetName) : "this person";
  return removeBidiControls(`${readFirstName(connectorName)} knows ${throughName}, who can reach ${target}.`);
}
