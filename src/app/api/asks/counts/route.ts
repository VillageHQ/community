import { readNewOfferCount } from "@/modules/asks/reads";
import { asksRoutes } from "@/modules/asks/routes";
import { emptyBodySchema } from "@/platform/http/contract";

export const POST = asksRoutes.member("asks-counts", emptyBodySchema, async ({ database, member }) =>
  Response.json({ newOffers: await readNewOfferCount(database, member.id) }),
);
