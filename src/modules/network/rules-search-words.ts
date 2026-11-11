// The words search shows, as Founderhall writes them.

export function readFirstWord(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

// "Marcus’" and "Ada’s": the possessive with a typographic apostrophe.
export function toPossessive(name: string) {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

// "Northwind Founders" stays as it is; "Acme Ventures" becomes "Acme Ventures members".
export function toMembersOf(community: string) {
  return /\b(founders|members|community)$/i.test(community.trim()) ? community : `${community} members`;
}

const NO_ARTICLE_STARTS = /^(a|an|the|someone|somebody|anyone|people|any|some|my|our)$/i;
const CUT_WORDS = /^(in|at|for|who|with|from|on|of)$/;
const VOWEL_SOUNDS = /^(hour|honest|heir|hr|mba|mp|mvp|seo|sdr|fbi)\b/i;
const CONSONANT_SOUNDS = /^(uni|use|usu|ux|ui\b|eu|one|once)/;

/**
 * "a zebra keeper in antarctica" from the search "zebra keeper in antarctica": an article only when the search starts
 * lower-case, has more than one word and none yet, and its head word is not a plural ("seed investors in climate" stays
 * as it is). "an" by sound, roughly.
 */
export function toReachPhrase(query: string) {
  let text = query.replace(/\s+/g, " ").trim();
  text = text.replace(/^(A|An|The) (?=[a-z])/, (word) => word.toLowerCase());
  const words = text.split(" ");
  if (words.length < 2 || !/^[a-z]/.test(text) || NO_ARTICLE_STARTS.test(words[0] ?? "")) return text;
  const cut = words.findIndex((word, position) => position > 0 && CUT_WORDS.test(word));
  const head = words[(cut > 0 ? cut : words.length) - 1] ?? "";
  if (/[^s]s$/.test(head)) return text;
  const isVowel = VOWEL_SOUNDS.test(text) || (/^[aeiou]/.test(text) && !CONSONANT_SOUNDS.test(text));
  return `${isVowel ? "an" : "a"} ${text}`;
}

export function readPeopleCountLine({ count, communityName, isEverywhere, isProfilesOnly, isCached }: { count: number; communityName: string; isEverywhere: boolean; isProfilesOnly: boolean; isCached: boolean }) {
  const people = `${count} ${count === 1 ? "person" : "people"}`;
  const where = isProfilesOnly ? " in member profiles" : isEverywhere ? " everywhere" : ` in reach through ${communityName}`;
  return `${people}${where}${isCached ? " · from the last 10 minutes" : ""}`;
}
