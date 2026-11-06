import { z } from "zod";

import { mintSyncToken } from "@/modules/network/service";
import { networkRoutes } from "@/modules/network/routes";

const emptyBodySchema = z.unknown();

export const POST = networkRoutes.member("network-sync-token", emptyBodySchema, async (context) =>
  Response.json(await mintSyncToken(context), { headers: { "Cache-Control": "no-store" } }),
);
