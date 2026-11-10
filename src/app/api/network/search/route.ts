import { z } from "zod";

import { SEARCH_PROMPT_MAX_LENGTH } from "@/modules/network/contract";
import { searchMemberNetwork } from "@/modules/network/service";
import { networkRoutes } from "@/modules/network/routes";

const DEADLINE_MS = 125_000;

export const maxDuration = 130;

const searchBodySchema = z.object({
  prompt: z.string().trim().min(1, "Enter who you're looking for.").max(SEARCH_PROMPT_MAX_LENGTH),
});

export const POST = networkRoutes.member(
  "network-search",
  searchBodySchema,
  async (context, body) => Response.json(await searchMemberNetwork(context, body.prompt)),
  { deadlineMs: DEADLINE_MS },
);
