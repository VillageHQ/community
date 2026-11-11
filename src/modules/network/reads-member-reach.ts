import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { memberNetwork } from "../members/schema.ts";
import { canMemberIntroduce } from "./service.ts";

// True when search can find paths through this member: they share their network with the community (joined its
// Village group), and the admins' "chosen introducers" rule doesn't leave them out. Never their contacts themselves.
export async function readSharesNetwork(database: Database, memberId: string) {
  const [joined] = await database
    .select({ userId: memberNetwork.userId })
    .from(memberNetwork)
    .where(and(eq(memberNetwork.userId, memberId), isNotNull(memberNetwork.groupJoinedAt)));
  return joined !== undefined && (await canMemberIntroduce(database, memberId));
}
