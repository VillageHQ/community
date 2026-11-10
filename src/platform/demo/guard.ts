import { count, sql } from "drizzle-orm";

import { user } from "../database/auth-schema.ts";
import type { DatabaseOrTransaction } from "../database/client.ts";
import { RECLAIMED_EMAIL_DOMAIN } from "../auth/reclaimed-email.ts";
import { readSettings } from "../settings/store.ts";
import { INSTANCE_SETTING_KEYS } from "../settings/schema.ts";
import { DEMO_EMAIL_DOMAIN } from "./mode.ts";

export const DEMO_GUARD = { empty: "empty", demo: "demo", refused: "refused" } as const;

export type DemoGuard = (typeof DEMO_GUARD)[keyof typeof DEMO_GUARD];

export const DEMO_REFUSAL_MESSAGE =
  "Demo mode is on (DEMO_MODE=true), but this database holds real members, so the app will not start. " +
  "Demo mode only runs on an empty database or on one the demo filled itself, because its nightly reset erases everything. " +
  "Turn DEMO_MODE off, or point DATABASE_URL at a new, empty database.";

// Demo mode may only run on a database the demo seeded: the seed's marker is there, and every member is made up
// (an example.com address, or one a removal already anonymised). An empty database is seeded at start.
export async function readDemoGuard(database: DatabaseOrTransaction): Promise<DemoGuard> {
  const [members] = await database
    .select({
      total: count(),
      outsiders: count(
        sql`case when ${user.email} not like ${`%@${DEMO_EMAIL_DOMAIN}`} and ${user.email} not like ${`%@${RECLAIMED_EMAIL_DOMAIN}`} then 1 end`,
      ),
    })
    .from(user);
  const marker = await readSettings(database, [INSTANCE_SETTING_KEYS.demoSeededAt]);
  const isSeeded = marker.has(INSTANCE_SETTING_KEYS.demoSeededAt);
  if (!members || members.total === 0) return isSeeded ? DEMO_GUARD.demo : DEMO_GUARD.empty;
  return isSeeded && members.outsiders === 0 ? DEMO_GUARD.demo : DEMO_GUARD.refused;
}
