import { z } from "zod";

import { advanceNetwork } from "@/modules/network/service";
import { createMemberRoute } from "@/platform/village/member-routes";

const emptyBodySchema = z.unknown();

export const POST = createMemberRoute("network-status", emptyBodySchema, async (context) =>
  Response.json(await advanceNetwork(context)),
);
