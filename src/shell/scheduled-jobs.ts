import "server-only";

import { MODULES } from "@/modules/registry";
import type { Database } from "@/platform/database/client";
import { PLATFORM_JOBS } from "@/platform/jobs/platform-jobs";
import type { ScheduledJob } from "@/platform/jobs/runner";
import { readEnabledIds } from "./enabled-modules";
import { CHAT_POSTS_JOB_NAME, runChatPosts, WEEKLY_EMAIL_JOB_NAME } from "./chat-posts";
import { runWeeklyEmails } from "./weekly-email";
import { DEMO_RESET_JOB } from "./demo-reset";
import { isDemoMode } from "@/platform/demo/mode";

const MINUTE_MS = 60_000;

// Jobs that read several modules. Each checks the modules it needs itself.
const SHELL_JOBS: readonly ScheduledJob[] = [
  { name: WEEKLY_EMAIL_JOB_NAME, intervalMs: 5 * MINUTE_MS, leaseMs: 10 * MINUTE_MS, run: (database, environment) => runWeeklyEmails(database, environment) },
  // After the weekly email, so the weekly line follows its run in the same tick. It checks the chat module itself.
  { name: CHAT_POSTS_JOB_NAME, intervalMs: MINUTE_MS, run: (database, environment) => runChatPosts(database, environment) },
];

// The platform's and the shell's jobs always run. A module's jobs run only while the module is on.
export async function readScheduledJobs(database: Database): Promise<ScheduledJob[]> {
  const enabledIds = await readEnabledIds(database);
  const moduleJobs = MODULES.flatMap(({ manifest, jobs }) => (jobs && enabledIds.has(manifest.id) ? jobs : []));
  // The weekly email runs before the outbox sender, so what it queues goes out in the same tick.
  // The demo's nightly reset exists only with DEMO_MODE=true.
  const demoJobs = isDemoMode(process.env) ? [DEMO_RESET_JOB] : [];
  return [...demoJobs, ...SHELL_JOBS, ...PLATFORM_JOBS, ...moduleJobs];
}
