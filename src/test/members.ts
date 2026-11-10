import { randomUUID } from "node:crypto";

import { user } from "../platform/database/auth-schema.ts";
import type { Database } from "../platform/database/client.ts";
import { memberProfile, memberTag } from "../modules/members/schema.ts";
import { normalizeTag } from "../modules/members/contract-profile.ts";

type DirectoryMemberSeed = {
  name: string;
  company?: string;
  canHelpWith?: string;
  stage?: string;
  sector?: string;
  cohort?: string;
  updatedAt?: Date;
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
    .values({
      userId: id,
      company: seed.company,
      canHelpWith: seed.canHelpWith,
      stage: seed.stage,
      sector: seed.sector,
      cohort: seed.cohort,
      onboardingCompletedAt: new Date(),
      ...(seed.updatedAt ? { updatedAt: seed.updatedAt } : {}),
    });
  for (const tag of seed.tags ?? []) {
    await database.insert(memberTag).values({ userId: id, tag, normalizedTag: normalizeTag(tag) });
  }
  return id;
}
