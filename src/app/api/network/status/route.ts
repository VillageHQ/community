import { z } from "zod";

import { advanceNetwork } from "@/modules/network/service";
import { networkRoutes } from "@/modules/network/routes";

const emptyBodySchema = z.unknown();

export const POST = networkRoutes.member("network-status", emptyBodySchema, async (context) =>
  Response.json(await advanceNetwork(context)),
);
