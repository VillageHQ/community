import { z } from "zod";

export const ASK_SKIP_ROUTE = "/api/asks/skip";

export const skipAskBodySchema = z.object({ askId: z.uuid() });
export const skippedAskSchema = z.object({ askId: z.uuid() });

export type SkipAskBody = z.infer<typeof skipAskBodySchema>;

// An ask someone else posted that this member could help with, and the words that say why.
export const helpableAskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  listedAt: z.string(),
  matchedWords: z.array(z.string()),
});

export type HelpableAsk = z.infer<typeof helpableAskSchema>;
