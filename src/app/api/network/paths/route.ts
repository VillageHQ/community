import { z } from "zod";

import { introsManifest } from "@/modules/intros/manifest";
import { readOpenAsks } from "@/modules/intros/reads-open-asks";
import { NO_OPEN_ASKS, readMemberPaths } from "@/modules/network/service";
import { isModuleEnabled } from "@/platform/modules/enablement";
import { networkRoutes } from "@/modules/network/routes";

const MAXIMUM_SLUG_LENGTH = 200;

const DEADLINE_MS = 65_000;

export const maxDuration = 70;

const pathsBodySchema = z.object({
  linkedinSlug: z.string().trim().toLowerCase().min(1).max(MAXIMUM_SLUG_LENGTH),
});

export const POST = networkRoutes.member(
  "network-paths",
  pathsBodySchema,
  async (context, body) => {
    const isIntrosOn = await isModuleEnabled(context.database, introsManifest);
    return Response.json(await readMemberPaths(context, body.linkedinSlug, isIntrosOn ? readOpenAsks : NO_OPEN_ASKS));
  },
  { deadlineMs: DEADLINE_MS },
);
