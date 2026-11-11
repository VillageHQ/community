import "server-only";

import { desc } from "drizzle-orm";

import type { Database } from "../../platform/database/client.ts";
import { emailOutbox, emailSuppression } from "../../platform/email/schema.ts";
import { EMAIL_LOG_PAGE_SIZE } from "./contract-email.ts";

// The latest emails, newest first: to, kind, status and time only.
export function readEmailLog(database: Database) {
  return database
    .select({ id: emailOutbox.id, toEmail: emailOutbox.toEmail, kind: emailOutbox.kind, status: emailOutbox.status, createdAt: emailOutbox.createdAt, finishedAt: emailOutbox.finishedAt })
    .from(emailOutbox)
    .orderBy(desc(emailOutbox.createdAt))
    .limit(EMAIL_LOG_PAGE_SIZE);
}

// Addresses that bounced or complained. Optional email skips them.
export function readDoNotSendList(database: Database) {
  return database.select().from(emailSuppression).orderBy(desc(emailSuppression.createdAt));
}
