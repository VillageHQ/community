import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

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

const runScrypt = promisify<string, Buffer, number, typeof SCRYPT_COST, Buffer>(scrypt);

const derivedKeys = new Map<string, Promise<Buffer>>();

// Deriving a key takes tens of milliseconds, and the home page reads the keys, so each instance derives it once.
function deriveKey(token: string, salt: Buffer) {
  const cacheKey = `${createHash("sha256").update(token).digest("hex")}:${salt.toString(ENCODING)}`;
  const remembered = derivedKeys.get(cacheKey);
  if (remembered) return remembered;
  if (derivedKeys.size >= MAXIMUM_REMEMBERED_KEYS) derivedKeys.clear();
  const derived = runScrypt(token, salt, KEY_BYTES, SCRYPT_COST);
  derivedKeys.set(cacheKey, derived);
  return derived;
}

export function isSealedValue(value: string) {
  return value.startsWith(`${ENVELOPE_PREFIX}.`);
}

export async function sealSecret(secret: string, token: string, label: string) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, await deriveKey(token, salt), iv);
  cipher.setAAD(Buffer.from(label));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return [ENVELOPE_PREFIX, salt.toString(ENCODING), iv.toString(ENCODING), encrypted.toString(ENCODING)].join(".");
}

function parseEnvelope(sealedValue: string) {
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

export async function openSealedSecret(sealedValue: string, token: string, label: string) {
  const envelope = parseEnvelope(sealedValue);
  if (!envelope) return null;
  try {
    const decipher = createDecipheriv(CIPHER, await deriveKey(token, envelope.salt), envelope.iv);
    decipher.setAAD(Buffer.from(label));
    decipher.setAuthTag(envelope.authTag);
    return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
