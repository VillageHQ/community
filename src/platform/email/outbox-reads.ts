import { and, count, desc, eq, gte } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import { OUTBOX_STATUSES } from "./outbox.ts";
import { emailOutbox } from "./schema.ts";

const NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const NOTICE_LIMIT = 5;

export type GivenUpEmail = { id: string; kind: string; toEmail: string; subject: string; lastError: string | null; finishedAt: string };

// Emails the sender gave up on this week, for the admin's notice.
export async function readGivenUpEmails(database: Database, now = new Date()) {
  const isGivenUpThisWeek = and(eq(emailOutbox.status, OUTBOX_STATUSES.failed), gte(emailOutbox.finishedAt, new Date(now.getTime() - NOTICE_WINDOW_MS)));
  const [total] = await database.select({ value: count() }).from(emailOutbox).where(isGivenUpThisWeek);
  const rows = await database
    .select({
      id: emailOutbox.id,
      kind: emailOutbox.kind,
      toEmail: emailOutbox.toEmail,
      subject: emailOutbox.subject,
      lastError: emailOutbox.lastError,
      finishedAt: emailOutbox.finishedAt,
    })
    .from(emailOutbox)
    .where(isGivenUpThisWeek)
    .orderBy(desc(emailOutbox.finishedAt))
    .limit(NOTICE_LIMIT);
  const recent: GivenUpEmail[] = rows.map((row) => ({ ...row, finishedAt: (row.finishedAt ?? now).toISOString() }));
  return { total: total?.value ?? 0, recent };
}
