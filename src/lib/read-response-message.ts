import { z } from "zod";

const messageSchema = z.object({ message: z.string() });

export async function readResponseMessage(response: Response, fallbackMessage: string) {
  try {
    const parsed = messageSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.message : fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}
