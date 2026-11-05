import { z } from "zod";

const messageSchema = z.object({ message: z.string() });
const failureSchema = z.object({ message: z.string().optional(), code: z.string().optional() });

export async function readResponseMessage(response: Response, fallbackMessage: string) {
  try {
    const parsed = messageSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.message : fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function readResponseFailure(response: Response, fallbackMessage: string) {
  try {
    const parsed = failureSchema.safeParse(await response.json());
    return { message: parsed.data?.message ?? fallbackMessage, code: parsed.data?.code ?? null };
  } catch {
    return { message: fallbackMessage, code: null };
  }
}
