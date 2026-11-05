import { z } from "zod";

import { readOpenAsks } from "@/modules/intros/reads-open-asks";
import { readMemberPaths } from "@/modules/network/service";
import { createMemberRoute } from "@/platform/village/member-routes";

const MAXIMUM_SLUG_LENGTH = 200;

const DEADLINE_MS = 65_000;

export const maxDuration = 70;

const pathsBodySchema = z.object({
  linkedinSlug: z.string().trim().toLowerCase().min(1).max(MAXIMUM_SLUG_LENGTH),
});

export const POST = createMemberRoute(
  "network-paths",
  pathsBodySchema,
  async (context, body) => Response.json(await readMemberPaths(context, body.linkedinSlug, readOpenAsks)),
  { deadlineMs: DEADLINE_MS },
);
