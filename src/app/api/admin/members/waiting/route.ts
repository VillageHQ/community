import { z } from "zod";

import { readWaitingMemberCount, readWaitingMembers } from "@/modules/members/service-admin";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "members-waiting",
  z.unknown(),
  async ({ database }) =>
    Response.json({ members: await readWaitingMembers(database), waitingCount: await readWaitingMemberCount(database) }),
  { adminOnly: true },
);
