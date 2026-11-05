import { z } from "zod";

import { leaveCommunityGroup } from "@/modules/network/service";
import { networkRoutes } from "@/modules/network/routes";

const leaveBodySchema = z.object({
  confirmed: z.literal(true, "Confirm that you want to leave the group."),
});

export const POST = networkRoutes.member("network-leave", leaveBodySchema, async (context) => {
  await leaveCommunityGroup(context);
  return Response.json({ message: "You left the group." });
}, { staysOpenWhenOff: true });
