import { createHmac } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { resolveAuthSecret } from "../auth/auth-secret.ts";
import type { Database, DatabaseOrTransaction } from "../database/client.ts";
import type { Environment } from "../environment.ts";
import { resolveAppUrl } from "../http/app-url.ts";
import { API_ROUTES, ROUTES } from "../http/routes.ts";
import { secretsMatch } from "../secrets/secrets-match.ts";
import { escapeHtml } from "./email-text.ts";
import { isEmailTopic, type EmailTopic } from "./kinds.ts";
import { emailOptOut } from "./schema.ts";

const TOKEN_PURPOSE = "email-unsubscribe";
const TOKEN_SEPARATOR = ".";
const PAYLOAD_SEPARATOR = ":";

export const UNSUBSCRIBE_PAGE_FIELD = "fromPage";
// A plain-text email (Founderhall's words) places its own "Stop … : <link>" line: the sender puts the member's
// unsubscribe page where this mark is, instead of adding the usual footer.
export const UNSUBSCRIBE_URL_MARK = "[[unsubscribe-url]]";

export type UnsubscribeTarget = { memberId: string; topic: EmailTopic };

function sign(secret: string, payload: string) {
  return createHmac("sha256", secret).update(`${TOKEN_PURPOSE}${PAYLOAD_SEPARATOR}${payload}`).digest("base64url");
}

export async function createUnsubscribeToken(database: Database, environment: Environment, { memberId, topic }: UnsubscribeTarget) {
  const payload = Buffer.from(`${memberId}${PAYLOAD_SEPARATOR}${topic}`).toString("base64url");
  return `${payload}${TOKEN_SEPARATOR}${sign(await resolveAuthSecret(database, environment), payload)}`;
}

export async function readUnsubscribeToken(database: Database, environment: Environment, token: string): Promise<UnsubscribeTarget | null> {
  const [payload, signature, ...rest] = token.split(TOKEN_SEPARATOR);
  if (!payload || !signature || rest.length > 0) return null;
  if (!secretsMatch(signature, sign(await resolveAuthSecret(database, environment), payload))) return null;

  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const separatorIndex = decoded.lastIndexOf(PAYLOAD_SEPARATOR);
  const memberId = decoded.slice(0, separatorIndex);
  const topic = decoded.slice(separatorIndex + 1);
  if (separatorIndex <= 0 || !isEmailTopic(topic)) return null;
  return { memberId, topic };
}

export async function buildUnsubscribeParts(database: Database, environment: Environment, target: UnsubscribeTarget) {
  const token = encodeURIComponent(await createUnsubscribeToken(database, environment, target));
  const appUrl = resolveAppUrl(environment);
  const pageUrl = `${appUrl}${ROUTES.unsubscribe}?token=${token}`;
  return {
    pageUrl,
    headers: {
      "List-Unsubscribe": `<${appUrl}${API_ROUTES.emailUnsubscribe}?token=${token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    htmlFooter: `<p style="font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#566463;max-width:520px;margin:0 auto;padding:0 24px 24px">Don't want these emails? <a href="${escapeHtml(pageUrl)}" style="color:#566463">Turn them off</a>.</p>`,
    textFooter: `\n\nDon't want these emails? Turn them off: ${pageUrl}`,
  };
}

export async function setEmailTopic(connection: DatabaseOrTransaction, { memberId, topic }: UnsubscribeTarget, isOn: boolean) {
  if (isOn) {
    await connection.delete(emailOptOut).where(and(eq(emailOptOut.memberId, memberId), eq(emailOptOut.topic, topic)));
    return;
  }
  await connection.insert(emailOptOut).values({ memberId, topic }).onConflictDoNothing();
}

export async function readOptedOutTopics(connection: DatabaseOrTransaction, memberId: string) {
  const rows = await connection.select({ topic: emailOptOut.topic }).from(emailOptOut).where(eq(emailOptOut.memberId, memberId));
  return new Set(rows.map(({ topic }) => topic));
}
