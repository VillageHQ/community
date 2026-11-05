import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createInviteToken() {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isInviteTokenShape(token: string) {
  return TOKEN_PATTERN.test(token);
}
