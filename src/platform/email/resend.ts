import type { Environment } from "../environment.ts";

const RESEND_API_URL = "https://api.resend.com";
const EMAILS_PATH = "/emails";
const SEND_TIMEOUT_MS = 8_000;

export type ResendConfig = { apiKey: string; fromAddress: string; apiUrl: string };

type OutgoingEmail = {
  to: string | readonly string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  replyTo?: string | null;
  headers?: Readonly<Record<string, string>>;
};

export function readResendConfig(environment: Environment): ResendConfig | null {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const fromAddress = environment.RESEND_FROM_ADDRESS?.trim();
  if (!apiKey || !fromAddress) return null;
  return { apiKey, fromAddress, apiUrl: environment.RESEND_API_URL?.trim() || RESEND_API_URL };
}

export async function sendResendEmail({ apiKey, fromAddress, apiUrl }: ResendConfig, email: OutgoingEmail) {
  const response = await fetch(`${apiUrl}${EMAILS_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": email.idempotencyKey,
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [email.to].flat(),
      subject: email.subject,
      html: email.html,
      text: email.text,
      ...(email.replyTo ? { reply_to: email.replyTo } : {}),
      ...(email.headers ? { headers: email.headers } : {}),
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Resend answered ${response.status}.`);
}
