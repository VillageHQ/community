// Founderhall's four avatar tints (t1–t4), picked by a hash of the member's id (its lib/html.mjs tint()).
const AVATAR_TINTS = ["t1", "t2", "t3", "t4"] as const;
const MAXIMUM_INITIALS = 2;
const HASH_MULTIPLIER = 31;
const UNKNOWN_INITIALS = "?";

export type AvatarTint = (typeof AVATAR_TINTS)[number];

export function readInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstAndLast = words.length > MAXIMUM_INITIALS ? [words[0] ?? "", words.at(-1) ?? ""] : words;
  const initials = firstAndLast.map((word) => Array.from(word)[0]?.toUpperCase() ?? "").join("");
  return initials || UNKNOWN_INITIALS;
}

export function readFirstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function pickAvatarTint(stableId: string): AvatarTint {
  let hash = 0;
  for (const character of stableId) {
    hash = (hash * HASH_MULTIPLIER + (character.codePointAt(0) ?? 0)) >>> 0;
  }
  return AVATAR_TINTS[hash % AVATAR_TINTS.length] ?? AVATAR_TINTS[0];
}
