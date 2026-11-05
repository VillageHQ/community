import { z } from "zod";

import { createCommunityGroup } from "@/modules/network/service";
import { createMemberRoute } from "@/platform/village/member-routes";

const MAXIMUM_GROUP_NAME_LENGTH = 100;

const groupBodySchema = z.object({
  name: z.string().trim().min(1, "Enter a group name.").max(MAXIMUM_GROUP_NAME_LENGTH),
  acknowledged: z.literal(true, "Confirm that your network becomes shared."),
});

export const POST = createMemberRoute(
  "village-group",
  groupBodySchema,
  async (context, body) => {
    await createCommunityGroup(context, body.name);
    return Response.json({ message: "Group created." });
  },
  { adminOnly: true },
);
