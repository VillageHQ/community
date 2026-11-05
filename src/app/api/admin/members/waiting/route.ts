import { z } from "zod";

import { readWaitingMemberCount, readWaitingMembers } from "@/lib/members/member-admin";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "members-waiting",
  z.unknown(),
  async ({ database }) =>
    Response.json({ members: await readWaitingMembers(database), waitingCount: await readWaitingMemberCount(database) }),
  { adminOnly: true },
);
