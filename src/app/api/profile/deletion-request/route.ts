import { z } from "zod";

import { membersRoutes } from "@/modules/members/routes";
import { requestAccountDeletion } from "@/modules/members/service-deletion-request";

export const POST = membersRoutes.member("profile-deletion-request", z.object({}).strict(), async (context) => {
  const requestedAt = await requestAccountDeletion(context);
  return Response.json({ requestedAt: requestedAt.toISOString() });
});
