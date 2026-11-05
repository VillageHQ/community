import { z } from "zod";

import { leaveCommunityGroup } from "@/lib/village/member-network";
import { createMemberRoute } from "@/platform/village/member-routes";

const leaveBodySchema = z.object({
  confirmed: z.literal(true, "Confirm that you want to leave the group."),
});

export const POST = createMemberRoute("network-leave", leaveBodySchema, async (context) => {
  await leaveCommunityGroup(context);
  return Response.json({ message: "You left the group." });
});
