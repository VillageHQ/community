import { z } from "zod";

import { readWaitingMemberCount, readWaitingMembers } from "@/lib/members/member-admin";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "members-waiting",
  z.unknown(),
  async ({ database }) =>
    Response.json({ members: await readWaitingMembers(database), waitingCount: await readWaitingMemberCount(database) }),
  { adminOnly: true },
);
