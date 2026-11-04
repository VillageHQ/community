import "server-only";

import { createHash } from "node:crypto";

const TOKEN_REUSE_MS = 60 * 60 * 1000;
const MAXIMUM_REUSABLE_TOKENS = 1_000;

const reusableTokens = new Map<string, { token: string; reusableUntilMs: number }>();

function evictOldestToken() {
  const oldestKey = reusableTokens.keys().next().value;
  if (oldestKey) reusableTokens.delete(oldestKey);
}

function toTokenKey(identityParts: readonly string[]) {
  return createHash("sha256").update(identityParts.join("\n")).digest("hex");
}

export function dropReusableToken(identityParts: readonly string[]) {
  reusableTokens.delete(toTokenKey(identityParts));
}

export async function withReusableToken(
  identityParts: readonly string[],
  mintToken: () => Promise<string>,
) {
  const key = toTokenKey(identityParts);
  const reusable = reusableTokens.get(key);
  if (reusable && reusable.reusableUntilMs > Date.now()) return reusable.token;

  const token = await mintToken();
  reusableTokens.delete(key);
  if (reusableTokens.size >= MAXIMUM_REUSABLE_TOKENS) evictOldestToken();
  reusableTokens.set(key, { token, reusableUntilMs: Date.now() + TOKEN_REUSE_MS });
  return token;
}
