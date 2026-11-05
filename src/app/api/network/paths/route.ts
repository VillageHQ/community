import { z } from "zod";

import { readMemberPaths } from "@/lib/village/member-network";
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
  async (context, body) => Response.json(await readMemberPaths(context, body.linkedinSlug)),
  { deadlineMs: DEADLINE_MS },
);
