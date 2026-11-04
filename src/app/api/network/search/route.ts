import { z } from "zod";

import { searchMemberNetwork } from "@/lib/village/member-network";
import { createMemberRoute } from "@/lib/village/member-route";

const MAXIMUM_PROMPT_LENGTH = 500;

const DEADLINE_MS = 125_000;

export const maxDuration = 130;

const searchBodySchema = z.object({
  prompt: z.string().trim().min(1, "Enter who you're looking for.").max(MAXIMUM_PROMPT_LENGTH),
});

export const POST = createMemberRoute(
  "network-search",
  searchBodySchema,
  async (context, body) => Response.json(await searchMemberNetwork(context, body.prompt)),
  { deadlineMs: DEADLINE_MS },
);
