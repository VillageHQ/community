import { z } from "zod";

import { advanceNetwork } from "@/lib/village/member-network";
import { createMemberRoute } from "@/lib/village/member-route";

const emptyBodySchema = z.unknown();

export const POST = createMemberRoute("network-status", emptyBodySchema, async (context) =>
  Response.json(await advanceNetwork(context)),
);
