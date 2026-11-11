import { z } from "zod";

import { introsManifest } from "@/modules/intros/manifest";
import { readOpenAsks } from "@/modules/intros/reads-open-asks";
import { SEARCH_PROMPT_MAX_LENGTH, searchWhereSchema } from "@/modules/network/contract";
import { NO_OPEN_ASKS, searchMemberNetwork } from "@/modules/network/service";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { networkRoutes } from "@/modules/network/routes";

const DEADLINE_MS = 125_000;

export const maxDuration = 130;

const searchBodySchema = z.object({
  prompt: z.string().trim().min(1, "Enter who you're looking for.").max(SEARCH_PROMPT_MAX_LENGTH),
  // "In our network" or "Everywhere"; the admin's default when left out.
  scope: searchWhereSchema.nullish(),
});

export const POST = networkRoutes.member(
  "network-search",
  searchBodySchema,
  async (context, body) => {
    const isIntrosOn = await isModuleEnabled(context.database, introsManifest);
    return Response.json(await searchMemberNetwork(context, body.prompt, body.scope ?? null, isIntrosOn ? readOpenAsks : NO_OPEN_ASKS));
  },
  { deadlineMs: DEADLINE_MS },
);
