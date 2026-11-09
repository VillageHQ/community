// Simple word overlap, no AI: an ask matches a member when a word of its title or detail is one of
// the words in the member's "can help with" line or tags. Short and common words never count.
const MINIMUM_WORD_LENGTH = 3;
const COMMON_WORDS = new Set([
  "and", "the", "for", "with", "you", "your", "our", "can", "who", "any", "anyone", "someone", "need", "needs", "looking",
  "want", "help", "helping", "know", "about", "from", "that", "this", "have", "has", "into", "are", "how", "what", "would",
  "like", "get", "out", "not", "but", "all", "one", "new", "intro", "introduction", "please", "thanks", "just", "some",
]);

export function readWords(text: string | null | undefined) {
  const words = new Set<string>();
  for (const word of (text ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (word.length >= MINIMUM_WORD_LENGTH && !COMMON_WORDS.has(word)) words.add(word);
  }
  return words;
}

// Plural and singular count as the same word: "investors" matches "investor".
function stem(word: string) {
  return word.length > MINIMUM_WORD_LENGTH + 1 && word.endsWith("s") ? word.slice(0, -1) : word;
}

export function findMatchedWords(askText: string, helperWords: ReadonlySet<string>) {
  const helperStems = new Map([...helperWords].map((word) => [stem(word), word]));
  const matched = new Set<string>();
  for (const word of readWords(askText)) {
    const helperWord = helperStems.get(stem(word));
    if (helperWord) matched.add(helperWord);
  }
  return [...matched];
}
