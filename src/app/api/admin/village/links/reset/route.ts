import { z } from "zod";

import { resetVillageLink } from "@/lib/village/member-network";
import { createMemberRoute } from "@/platform/village/member-routes";

const resetBodySchema = z.object({
  memberId: z.string().min(1),
  confirmed: z.literal(true, "Confirm the reset."),
});

export const POST = createMemberRoute(
  "village-link-reset",
  resetBodySchema,
  async (context, body) => {
    await resetVillageLink(context, body.memberId);
    return Response.json({ message: "Village link reset." });
  },
  { adminOnly: true },
);
