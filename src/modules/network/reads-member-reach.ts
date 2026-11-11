import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { memberNetwork } from "../members/schema.ts";
import { canMemberIntroduce } from "./service.ts";

// What search can do through this member: `isIntroducer` is false when the admins limited intros to chosen members
// and this one isn't chosen; `sharesNetwork` when they also joined the community's Village group. Never their contacts.
export async function readMemberReach(database: Database, memberId: string) {
  const isIntroducer = await canMemberIntroduce(database, memberId);
  const [joined] = await database
    .select({ userId: memberNetwork.userId })
    .from(memberNetwork)
    .where(and(eq(memberNetwork.userId, memberId), isNotNull(memberNetwork.groupJoinedAt)));
  return { isIntroducer, sharesNetwork: isIntroducer && joined !== undefined };
}
