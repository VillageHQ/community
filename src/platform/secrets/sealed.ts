import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const SEALED_PREFIX = "sealed.";
const ENVELOPE_PREFIX = "sealed.v1";
const ENVELOPE_PART_COUNT = 5;
const CIPHER = "aes-256-gcm";
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ENCODING = "base64url";
const MAXIMUM_REMEMBERED_KEYS = 8;

// SETUP_TOKEN is a password a person chose, and a stolen backup can be attacked offline, so the key has to be slow to guess.
const SCRYPT_COST = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export const OPEN_OUTCOMES = {
  opened: "opened",
  wrongToken: "wrong_token",
  unsupported: "unsupported",
  derivationFailed: "derivation_failed",
} as const;

export type OpenResult =
  | { outcome: typeof OPEN_OUTCOMES.opened; secret: string }
  | { outcome: Exclude<(typeof OPEN_OUTCOMES)[keyof typeof OPEN_OUTCOMES], typeof OPEN_OUTCOMES.opened> };

const runScrypt = promisify<string, Buffer, number, typeof SCRYPT_COST, Buffer>(scrypt);

declare global {
  // Next can bundle this file more than once. The keys live on globalThis so a process derives each one once.
  var communitySealingKeys: Map<string, Promise<Buffer>> | undefined;
  var communitySealingSalt: Buffer | undefined;
}

function readRememberedKeys() {
  globalThis.communitySealingKeys ??= new Map();
  return globalThis.communitySealingKeys;
}

function readSealingSalt() {
  globalThis.communitySealingSalt ??= randomBytes(SALT_BYTES);
  return globalThis.communitySealingSalt;
}

// Deriving a key costs tens of milliseconds and 32 MiB. Callers at the same moment share one derivation, and a
// failed one is forgotten, so it can be tried again.
function deriveKey(token: string, salt: Buffer) {
  const rememberedKeys = readRememberedKeys();
  const cacheKey = `${createHash("sha256").update(token).digest("hex")}:${salt.toString(ENCODING)}`;
  const remembered = rememberedKeys.get(cacheKey);
  if (remembered) return remembered;
  if (rememberedKeys.size >= MAXIMUM_REMEMBERED_KEYS) rememberedKeys.clear();

  const derived = runScrypt(token, salt, KEY_BYTES, SCRYPT_COST);
  rememberedKeys.set(cacheKey, derived);
  derived.catch(() => rememberedKeys.delete(cacheKey));
  return derived;
}

// Anything that starts this way is treated as sealed. A version this build doesn't know must never be read as a plain key.
export function looksSealed(value: string) {
  return value.startsWith(SEALED_PREFIX);
}

export async function sealSecret(secret: string, token: string, label: string) {
  const salt = readSealingSalt();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, await deriveKey(token, salt), iv);
  cipher.setAAD(Buffer.from(label));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return [ENVELOPE_PREFIX, salt.toString(ENCODING), iv.toString(ENCODING), encrypted.toString(ENCODING)].join(".");
}

function parseEnvelope(sealedValue: string) {
  if (!sealedValue.startsWith(`${ENVELOPE_PREFIX}.`)) return null;
  const parts = sealedValue.split(".");
  if (parts.length !== ENVELOPE_PART_COUNT) return null;
  const [, , salt, iv, encrypted] = parts;
  if (!salt || !iv || !encrypted) return null;
  const encryptedBytes = Buffer.from(encrypted, ENCODING);
  if (encryptedBytes.length < AUTH_TAG_BYTES) return null;
  return {
    salt: Buffer.from(salt, ENCODING),
    iv: Buffer.from(iv, ENCODING),
    ciphertext: encryptedBytes.subarray(0, encryptedBytes.length - AUTH_TAG_BYTES),
    authTag: encryptedBytes.subarray(encryptedBytes.length - AUTH_TAG_BYTES),
  };
}

async function readDerivedKey(token: string, salt: Buffer) {
  try {
    return await deriveKey(token, salt);
  } catch {
    return null;
  }
}

function decrypt(key: Buffer, { iv, ciphertext, authTag }: { iv: Buffer; ciphertext: Buffer; authTag: Buffer }, label: string) {
  try {
    const decipher = createDecipheriv(CIPHER, key, iv);
    decipher.setAAD(Buffer.from(label));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export async function openSealedSecret(sealedValue: string, token: string, label: string): Promise<OpenResult> {
  const envelope = parseEnvelope(sealedValue);
  if (!envelope) return { outcome: OPEN_OUTCOMES.unsupported };

  const key = await readDerivedKey(token, envelope.salt);
  if (!key) return { outcome: OPEN_OUTCOMES.derivationFailed };

  const secret = decrypt(key, envelope, label);
  return secret === null ? { outcome: OPEN_OUTCOMES.wrongToken } : { outcome: OPEN_OUTCOMES.opened, secret };
}
