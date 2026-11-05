import { z } from "zod";

import { approveVillageLink } from "@/lib/village/member-network";
import { createMemberRoute } from "@/platform/village/member-routes";

const linkBodySchema = z.object({
  memberId: z.string().min(1),
  villageEmail: z.string().min(1),
});

export const POST = createMemberRoute(
  "village-links",
  linkBodySchema,
  async (context, body) => {
    await approveVillageLink(context, body.memberId, body.villageEmail);
    return Response.json({ message: "Village link approved." });
  },
  { adminOnly: true },
);
