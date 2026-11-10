// Simple word overlap, no AI: an ask matches a member when a word of its title or detail is one of
// the words in the member's "can help with" line or tags. The helper email and the Today list both
// use these two functions, so they can't disagree. Short words, stop words and everyday words that
// name no skill ("first", "team", "help") never count.
const MINIMUM_WORD_LENGTH = 3;
const COMMON_WORDS = new Set(
  (
    // Stop words.
    "a about above after again against all almost also although always am among an and another any anyone anything " +
    "anywhere are around as at back be became because become been before being below between both but by can cannot " +
    "could did do does doing done down during each either else enough etc even ever every everyone everything for from " +
    "further had has have having he her here hers herself him himself his how however i if in into is it its itself " +
    "just least less let lets like made make makes making many may maybe me might mine more most much must my myself " +
    "near need needs neither never no nobody none nor not nothing now of off often on once one only onto or other " +
    "others otherwise our ours ourselves out over own per perhaps please quite rather really same see seem seems she " +
    "should since so some somebody someone something sometimes somewhere soon still such than thank thanks that the " +
    "their theirs them themselves then there these they thing things this those though through thus till to together " +
    "too toward towards under until up upon us very via was way ways we well were what whatever when where whether " +
    "which while who whoever whole whom whose why will with within without would yes yet you your yours yourself " +
    // Everyday words that name no skill or topic.
    "able ask asking best better big came come comes coming day days early easy find finding first get gets getting " +
    "give given go goes going good got great hello help helped helping helps hey hi know knows last later " +
    "look looking looks lot lots love new next nice old people person place plan put ready right say second soon " +
    "start started starting stuff sure take talk team teams tell think third time times today try trying use used " +
    "using want wanted wants week weeks work worked working works year years " +
    // Words every ask and profile in a founder community share.
    "advice anybody chat company companies connect founder founders guidance head intro intros introduction " +
    "introductions startup startups thoughts"
  ).split(" "),
);

export function readWords(text: string | null | undefined) {
  const words = new Set<string>();
  for (const word of (text ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length >= MINIMUM_WORD_LENGTH && !COMMON_WORDS.has(word) && !/^\p{N}+$/u.test(word)) words.add(word);
  }
  return words;
}

// Plural and singular count as the same word: "investors" matches "investor".
function stem(word: string) {
  return word.length > MINIMUM_WORD_LENGTH + 1 && word.endsWith("s") ? word.slice(0, -1) : word;
}

// The helper's own words that the ask shares, in the helper's order, so the reason names their skill.
export function findMatchedWords(askText: string, helperWords: ReadonlySet<string>) {
  const askStems = new Set([...readWords(askText)].map(stem));
  const matched = new Set<string>();
  for (const word of helperWords) {
    if (!COMMON_WORDS.has(word) && askStems.has(stem(word))) matched.add(word);
  }
  return [...matched];
}
