import { removeBidiControls } from "../safe-text.ts";

export const TEXT_SEGMENTS = { text: "text", link: "link" } as const;

export type TextSegment =
  | { kind: typeof TEXT_SEGMENTS.text; text: string }
  | { kind: typeof TEXT_SEGMENTS.link; text: string; href: string };

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);
const LINK_CANDIDATE = /(?<![\p{L}\p{N}:/.@_-])https?:\/\/[^\s<>"'`\p{Cc}\p{Cf}]+/giu;
const TRAILING_PUNCTUATION: ReadonlySet<string> = new Set([".", ",", ";", ":", "!", "?", "*", "_", "~"]);
const MATCHING_OPENERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
const MAXIMUM_LINK_LENGTH = 2048;
const MAXIMUM_HEADING_LENGTH = 100;
const COLLAPSED_CHARACTERS = 600;
const COLLAPSED_LINES = 8;
const ELLIPSIS = "…";

function countUnmatchedClosers(text: string) {
  const unmatched: Record<string, number> = {};
  for (const closer of Object.keys(MATCHING_OPENERS)) unmatched[closer] = 0;
  const closerByOpener = new Map(Object.entries(MATCHING_OPENERS).map(([closer, opener]) => [opener, closer]));

  for (const character of text) {
    const closer = closerByOpener.get(character);
    if (closer) unmatched[closer] = (unmatched[closer] ?? 0) - 1;
    if (MATCHING_OPENERS[character]) unmatched[character] = (unmatched[character] ?? 0) + 1;
  }
  return unmatched;
}

function trimLinkEnd(candidate: string) {
  const unmatched = countUnmatchedClosers(candidate);
  let end = candidate.length;

  while (end > 0) {
    const character = candidate[end - 1] ?? "";
    const isUnmatchedCloser = (unmatched[character] ?? 0) > 0;
    if (!TRAILING_PUNCTUATION.has(character) && !isUnmatchedCloser) break;
    if (isUnmatchedCloser) unmatched[character] = (unmatched[character] ?? 0) - 1;
    end -= 1;
  }
  return candidate.slice(0, end);
}

function toSafeHref(linkText: string) {
  if (linkText.length > MAXIMUM_LINK_LENGTH) return null;
  try {
    const url = new URL(linkText);
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || !url.hostname) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function splitIntoSegments(rawText: string) {
  const text = removeBidiControls(rawText);
  const segments: TextSegment[] = [];
  let position = 0;

  for (const match of text.matchAll(LINK_CANDIDATE)) {
    const linkText = trimLinkEnd(match[0]);
    const href = toSafeHref(linkText);
    if (!href) continue;

    if (match.index > position) segments.push({ kind: TEXT_SEGMENTS.text, text: text.slice(position, match.index) });
    segments.push({ kind: TEXT_SEGMENTS.link, text: linkText, href });
    position = match.index + linkText.length;
  }

  if (position < text.length) segments.push({ kind: TEXT_SEGMENTS.text, text: text.slice(position) });
  return segments;
}

function findLineLimit(text: string, lineBudget: number) {
  let position = -1;
  for (let line = 0; line < lineBudget; line += 1) {
    position = text.indexOf("\n", position + 1);
    if (position === -1) return text.length;
  }
  return Math.max(position, 0);
}

function cutAtWordEnd(text: string, limit: number) {
  const lastSpace = text.slice(0, limit).search(/\s\S*$/);
  return lastSpace > 0 ? text.slice(0, lastSpace) : text.slice(0, limit);
}

export function collapseSegments(segments: TextSegment[]) {
  const kept: TextSegment[] = [];
  let characterBudget = COLLAPSED_CHARACTERS;
  let lineBudget = COLLAPSED_LINES;

  for (const segment of segments) {
    if (segment.kind === TEXT_SEGMENTS.link && kept.length > 0 && segment.text.length > characterBudget) {
      return { segments: [...kept, { kind: TEXT_SEGMENTS.text, text: ELLIPSIS }], isCollapsed: true };
    }
    if (segment.kind === TEXT_SEGMENTS.link) {
      kept.push(segment);
      characterBudget -= segment.text.length;
      continue;
    }

    const limit = Math.min(findLineLimit(segment.text, lineBudget), Math.max(characterBudget, 0));
    if (limit < segment.text.length) {
      const preview = `${cutAtWordEnd(segment.text, limit).trimEnd()}${ELLIPSIS}`;
      return { segments: [...kept, { kind: TEXT_SEGMENTS.text, text: preview }], isCollapsed: true };
    }
    kept.push(segment);
    characterBudget -= segment.text.length;
    lineBudget -= segment.text.split("\n").length - 1;
  }
  return { segments: kept, isCollapsed: false };
}

export function splitAnnouncement(rawBody: string) {
  const body = removeBidiControls(rawBody);
  const lineBreak = body.indexOf("\n");
  const firstLine = lineBreak === -1 ? "" : body.slice(0, lineBreak).trim();
  if (!firstLine || firstLine.length > MAXIMUM_HEADING_LENGTH) return { heading: null, body };
  return { heading: firstLine, body: body.slice(lineBreak + 1).trim() };
}
