import "server-only";

import { isPreview } from "@/platform/database/migration-plan";
import type { Environment } from "@/platform/environment";
import { RequestError } from "@/platform/http/request-error";
import { looksSealed, openSealedSecret, OPEN_OUTCOMES, sealSecret } from "@/platform/secrets/sealed";
import { readSetupToken } from "@/platform/secrets/setup-token";

import { CHAT_ERROR_CODES, type ChatKind } from "./contract";

const UNPROCESSABLE_STATUS = 422;

export const CHAT_SECRET_FIELDS = { token: "token", signingSecret: "signing_secret" } as const;
type ChatSecretField = (typeof CHAT_SECRET_FIELDS)[keyof typeof CHAT_SECRET_FIELDS];

// The label is bound into the seal, so a sealed Slack token can't be opened as Discord's or as a signing secret.
function toLabel(kind: ChatKind, field: ChatSecretField) {
  return `chat_${field}:${kind}`;
}

export const CHAT_SECRET_STORAGE = { sealed: "sealed", unencrypted: "unencrypted", refused: "refused" } as const;
export type ChatSecretStorage = (typeof CHAT_SECRET_STORAGE)[keyof typeof CHAT_SECRET_STORAGE];

// Says how a save would store the tokens, so the page can warn before the admin pastes anything.
export function readChatSecretStorage(environment: Environment): ChatSecretStorage {
  if (isPreview(environment)) return CHAT_SECRET_STORAGE.refused;
  return readSetupToken(environment) ? CHAT_SECRET_STORAGE.sealed : CHAT_SECRET_STORAGE.unencrypted;
}

// Sealed like the Village secret: with SETUP_TOKEN when the site has one. A preview may share production's database,
// and its token would seal the tokens so production can't read them, so a preview can't save them.
export async function sealChatSecret(environment: Environment, kind: ChatKind, field: ChatSecretField, secret: string) {
  if (isPreview(environment)) {
    throw new RequestError(UNPROCESSABLE_STATUS, CHAT_ERROR_CODES.unstorable, "Slack and Discord can't be connected from a preview. Connect them on your live site.");
  }
  const token = readSetupToken(environment);
  return token ? sealSecret(secret, token, toLabel(kind, field)) : secret;
}

export const UNREADABLE_SECRET_MESSAGE = "The saved token can't be opened on this server (the setup token changed). Paste it again.";

// The opened secret, or null when this server can't open it.
export async function openChatSecret(environment: Environment, kind: ChatKind, field: ChatSecretField, stored: string | null) {
  if (!stored) return null;
  if (!looksSealed(stored)) return stored;
  const token = readSetupToken(environment);
  if (!token) return null;
  const result = await openSealedSecret(stored, token, toLabel(kind, field));
  return result.outcome === OPEN_OUTCOMES.opened ? result.secret : null;
}
