import { z } from "zod";

import { resetVillageLink } from "@/modules/network/service";
import { networkRoutes } from "@/modules/network/routes";

const resetBodySchema = z.object({
  memberId: z.string().min(1),
  confirmed: z.literal(true, "Confirm the reset."),
});

export const POST = networkRoutes.member(
  "village-link-reset",
  resetBodySchema,
  async (context, body) => {
    await resetVillageLink(context, body.memberId);
    return Response.json({ message: "Village link reset." });
  },
  { adminOnly: true },
);
