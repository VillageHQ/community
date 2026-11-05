import { randomUUID } from "node:crypto";

import { user } from "../platform/database/auth-schema.ts";
import type { Database } from "../platform/database/client.ts";
import { memberProfile, memberTag } from "../database/members-schema.ts";
import { normalizeTag } from "../lib/members/profile-api.ts";

type DirectoryMemberSeed = {
  name: string;
  company?: string;
  canHelpWith?: string;
  tags?: string[];
  banned?: boolean;
  banExpires?: Date;
  createdAt?: Date;
};

export async function seedMember(database: Database, seed: DirectoryMemberSeed) {
  const id = randomUUID();
  await database.insert(user).values({
    id,
    name: seed.name,
    email: `${id}@seeded.test`,
    emailVerified: true,
    role: "user",
    banned: seed.banned ?? false,
    banExpires: seed.banExpires,
    createdAt: seed.createdAt,
  });
  await database
    .insert(memberProfile)
    .values({ userId: id, company: seed.company, canHelpWith: seed.canHelpWith, onboardingCompletedAt: new Date() });
  for (const tag of seed.tags ?? []) {
    await database.insert(memberTag).values({ userId: id, tag, normalizedTag: normalizeTag(tag) });
  }
  return id;
}
