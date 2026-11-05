import { eq } from "drizzle-orm";

import { user } from "../platform/database/auth-schema.ts";
import type { Database } from "../platform/database/client.ts";
import { introRequest } from "../modules/intros/schema.ts";
import { memberNetwork } from "../modules/members/schema.ts";

const LONG_PAST = new Date("2020-01-01T00:00:00.000Z");

export async function joinMemberToGroup(database: Database, memberId: string, linkedinSlug: string) {
  const joined = { linkedinSlug, sharingConsentedAt: new Date(), groupJoinedAt: new Date() };
  const [network] = await database
    .insert(memberNetwork)
    .values({ userId: memberId, ...joined })
    .onConflictDoUpdate({ target: memberNetwork.userId, set: joined })
    .returning({ villageExternalId: memberNetwork.villageExternalId });
  if (!network) throw new Error("The member network row is missing.");
  return network.villageExternalId;
}

export async function nameMember(database: Database, memberId: string, name: string) {
  await database.update(user).set({ name }).where(eq(user.id, memberId));
}

export async function makeIntroOverdue(database: Database, introId: string) {
  await database.update(introRequest).set({ expiresAt: LONG_PAST }).where(eq(introRequest.id, introId));
}
