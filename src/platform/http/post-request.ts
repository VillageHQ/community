import type { z } from "zod";

import { readResponseFailure } from "./read-response-message.ts";

const FALLBACK_ERROR_MESSAGE = "Something went wrong. Try again.";
const UNREACHABLE_ERROR_MESSAGE = "We couldn't reach the server. Check your connection and try again.";

export class RequestFailure extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function sendPost(path: string, body: unknown) {
  try {
    return await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(UNREACHABLE_ERROR_MESSAGE);
  }
}

export async function postRequest<Schema extends z.ZodType>(
  path: string,
  body: unknown,
  schema: Schema,
  failureMessage = FALLBACK_ERROR_MESSAGE,
): Promise<z.infer<Schema>> {
  const response = await sendPost(path, body);
  if (!response.ok) {
    const { message, code } = await readResponseFailure(response, failureMessage);
    throw new RequestFailure(response.status, message, code);
  }
  return schema.parse(await response.json());
}
