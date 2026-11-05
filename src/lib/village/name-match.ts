const MINIMUM_NAME_TOKENS = 2;
const DIACRITICS = /\p{M}/gu;
const INVISIBLE_AND_APOSTROPHES = /[\p{Cf}'’]/gu;
const NOT_NAME_CHARACTERS = /[^\p{L}\p{N}]+/u;
const UNSPLIT_LETTERS = /[øłßæœđðþı]/g;

const FOLDED_LETTERS: Record<string, string> = {
  ø: "o",
  ł: "l",
  ß: "ss",
  æ: "ae",
  œ: "oe",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
};

function readNameTokens(name: string) {
  return name
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(INVISIBLE_AND_APOSTROPHES, "")
    .toLowerCase()
    .replace(UNSPLIT_LETTERS, (letter) => FOLDED_LETTERS[letter] ?? letter)
    .split(NOT_NAME_CHARACTERS)
    .filter(Boolean);
}

export function hasFirstAndLastName(name: string) {
  return readNameTokens(name).length >= MINIMUM_NAME_TOKENS;
}

export function namesMatch(firstName: string, secondName: string) {
  const first = readNameTokens(firstName);
  const second = readNameTokens(secondName);
  if (first.length < MINIMUM_NAME_TOKENS || second.length < MINIMUM_NAME_TOKENS) return false;
  return first[0] === second[0] && first.at(-1) === second.at(-1);
}
