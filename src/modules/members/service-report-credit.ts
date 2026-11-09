import "server-only";

import { eq } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { memberProfile } from "./schema.ts";

// "Credit me in reports": off by default. On, an admin's partner report may name this member among the top
// connectors. Off, they are only part of a count.
export async function readReportCredit(database: Database, memberId: string) {
  const [row] = await database.select({ isOn: memberProfile.creditInReports }).from(memberProfile).where(eq(memberProfile.userId, memberId));
  return row?.isOn ?? false;
}

export async function setReportCredit(database: Database, memberId: string, isOn: boolean) {
  await database
    .insert(memberProfile)
    .values({ userId: memberId, creditInReports: isOn })
    .onConflictDoUpdate({ target: memberProfile.userId, set: { creditInReports: isOn, updatedAt: new Date() } });
  return { isOn: await readReportCredit(database, memberId) };
}
