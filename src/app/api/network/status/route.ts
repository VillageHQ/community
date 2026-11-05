import { z } from "zod";

import { advanceNetwork } from "@/lib/village/member-network";
import { createMemberRoute } from "@/platform/village/member-routes";

const emptyBodySchema = z.unknown();

export const POST = createMemberRoute("network-status", emptyBodySchema, async (context) =>
  Response.json(await advanceNetwork(context)),
);
