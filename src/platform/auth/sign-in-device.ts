import { createHmac, randomBytes } from "node:crypto";

import { secretsMatch } from "../secrets/secrets-match.ts";

// A browser that signed in to an account with its password before gets this cookie: a random id, signed with the app's
// secret together with the account's email. Its wrong passwords then count on their own, so a stranger filling the
// account's count can't lock the member's own browser out (AUTH-10). It proves nothing else and signs nobody in.
export const SIGN_IN_DEVICE_COOKIE = "community_sign_in_device";
export const SIGN_IN_DEVICE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const PURPOSE = "sign-in-device";
const ID_BYTES = 16;
const SEPARATOR = ".";

function sign(secret: string, email: string, id: string) {
  return createHmac("sha256", secret).update(`${PURPOSE}:${email}:${id}`).digest("base64url");
}

export function createSignInDevice(secret: string, email: string) {
  const id = randomBytes(ID_BYTES).toString("base64url");
  return `${id}${SEPARATOR}${sign(secret, email, id)}`;
}

// The device's id when the cookie was made for this email with this secret, else null.
export function readSignInDevice(secret: string, email: string, value: string | null | undefined) {
  if (!value) return null;
  const [id, signature, ...rest] = value.split(SEPARATOR);
  if (!id || !signature || rest.length > 0) return null;
  return secretsMatch(signature, sign(secret, email, id)) ? id : null;
}
