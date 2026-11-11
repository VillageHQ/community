import { z } from "zod";

import type { ResendConfig } from "./resend.ts";

// Resend's "email.received" event says who sent what to whom, but not the words. Those come from
// its received-email API, read with the same API key the app sends with.
export const RECEIVED_EMAIL_EVENT = "email.received";

const RECEIVED_EMAILS_PATH = "/emails/receiving";
const FETCH_TIMEOUT_MS = 8_000;
const MAXIMUM_TEXT_LENGTH = 20_000;

const addressListSchema = z.union([z.string(), z.array(z.string())]).optional();

const receivedEventSchema = z.object({
  type: z.literal(RECEIVED_EMAIL_EVENT),
  data: z.object({
    email_id: z.string().min(1).max(200).optional(),
    id: z.string().min(1).max(200).optional(),
    from: z.string().max(500),
    to: addressListSchema,
    cc: addressListSchema,
    subject: z.string().nullable().optional(),
    headers: z.union([z.record(z.string(), z.unknown()), z.array(z.object({ name: z.string(), value: z.unknown() }))]).nullable().optional(),
    text: z.string().nullable().optional(),
    html: z.string().nullable().optional(),
  }),
});

const receivedEmailSchema = z.object({ text: z.string().nullable().optional(), html: z.string().nullable().optional() });

export type ReceivedEmail = { emailId: string | null; from: string; to: string[]; text: string | null; subject: string | null; autoSubmitted: string | null };

const AUTO_SUBMITTED = "auto-submitted";

// Resend may give headers as an object or as name and value pairs. Only Auto-Submitted is read.
function readAutoSubmitted(headers: Record<string, unknown> | { name: string; value: unknown }[] | null | undefined) {
  if (!headers) return null;
  const entries = Array.isArray(headers) ? headers.map(({ name, value }) => [name, value] as const) : Object.entries(headers);
  const value = entries.find(([name]) => name.toLowerCase() === AUTO_SUBMITTED)?.[1];
  return typeof value === "string" ? value : null;
}

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  nbsp: " ",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  amp: "&",
};

const MAXIMUM_CODE_POINT = 0x10ffff;

// One pass, so "&amp;lt;" stays "&lt;" as the writer meant.
function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,8});/gi, (whole, entity: string) => {
    if (entity.startsWith("#")) {
      const isHex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isInteger(code) && code > 0 && code <= MAXIMUM_CODE_POINT ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? whole;
  });
}

function toList(value: string | string[] | undefined) {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(",")).map((entry) => entry.trim()).filter(Boolean);
}

export function htmlToText(html: string) {
  const withoutTags = html
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(withoutTags);
}

function readText({ text, html }: { text?: string | null; html?: string | null }) {
  const words = text?.trim() ? text : html ? htmlToText(html) : null;
  return words ? words.slice(0, MAXIMUM_TEXT_LENGTH) : null;
}

// Null when the body isn't a received-email event.
export function readReceivedEmailEvent(body: string): ReceivedEmail | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  const event = receivedEventSchema.safeParse(parsed);
  if (!event.success) return null;
  const { data } = event.data;
  return {
    emailId: data.email_id ?? data.id ?? null,
    from: data.from,
    to: [...toList(data.to), ...toList(data.cc)],
    text: readText(data),
    subject: data.subject ?? null,
    autoSubmitted: readAutoSubmitted(data.headers),
  };
}

export function isReceivedEmailEvent(body: string) {
  try {
    const parsed: unknown = JSON.parse(body);
    return z.object({ type: z.literal(RECEIVED_EMAIL_EVENT) }).safeParse(parsed).success;
  } catch {
    return false;
  }
}

export async function fetchReceivedText({ apiKey, apiUrl }: ResendConfig, emailId: string) {
  const response = await fetch(`${apiUrl}${RECEIVED_EMAILS_PATH}/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status} for a received email.`);
  const body: unknown = await response.json();
  return readText(receivedEmailSchema.parse(body));
}
