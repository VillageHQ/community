import type { Environment } from "../environment.ts";

export const MINIMUM_SETUP_TOKEN_LENGTH = 32;
const MINIMUM_DISTINCT_CHARACTERS = 8;
const REPEATED_SUBSTRING_LENGTH = 8;

function hasRepeatedSubstring(token: string) {
  const seen = new Set<string>();
  for (let start = 0; start <= token.length - REPEATED_SUBSTRING_LENGTH; start += 1) {
    const substring = token.slice(start, start + REPEATED_SUBSTRING_LENGTH);
    if (seen.has(substring)) return true;
    seen.add(substring);
  }
  return false;
}

export function readSetupToken(environment: Environment) {
  const token = environment.SETUP_TOKEN;
  if (!token || token.length < MINIMUM_SETUP_TOKEN_LENGTH) return null;
  if (new Set(token).size < MINIMUM_DISTINCT_CHARACTERS) return null;
  if (hasRepeatedSubstring(token)) return null;
  return token;
}
