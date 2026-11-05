import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function secretsMatch(candidate: string, expected: string) {
  return timingSafeEqual(digest(candidate), digest(expected));
}
