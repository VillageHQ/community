import { z } from "zod";

export const ASK_SKIP_ROUTE = "/api/asks/skip";

export const skipAskBodySchema = z.object({ askId: z.uuid() });
export const skippedAskSchema = z.object({ askId: z.uuid() });

export type SkipAskBody = z.infer<typeof skipAskBodySchema>;

// An ask someone else posted that this member could help with. `matchedWords` are the skills they share; `why` is
// the reason saved when the ask was routed to them (a path to the person it names, or the shared words), if it was.
export const helpableAskSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  author: z.object({ id: z.string(), name: z.string(), avatarUrl: z.string().nullable() }),
  listedAt: z.string(),
  createdAt: z.string(),
  matchedWords: z.array(z.string()),
  why: z.string().nullable(),
  // Founderhall's lines: "Trying to reach: …" and "Why you: …".
  who: z.string().nullable(),
  whyYou: z.string(),
});

export type HelpableAsk = z.infer<typeof helpableAskSchema>;

// The reason line shown with the ask: the skills the member shares with it, or else why it was sent to them.
export function describeWhyYou({ matchedWords, why }: Pick<HelpableAsk, "matchedWords" | "why">) {
  return matchedWords.length > 0 ? `You said you can help with ${matchedWords.join(", ")}` : (why ?? "");
}
