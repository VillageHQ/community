import { pruneFinishedEmails, sendDueEmails } from "../email/outbox-sender.ts";
import type { ScheduledJob } from "./runner.ts";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const PLATFORM_JOBS: readonly ScheduledJob[] = [
  { name: "email-outbox", intervalMs: MINUTE_MS, run: sendDueEmails },
  { name: "email-outbox-pruning", intervalMs: DAY_MS, run: (database) => pruneFinishedEmails(database) },
];
