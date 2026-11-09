import { getDatabase } from "@/platform/database/client";
import { runDueJobs } from "@/platform/jobs/runner";
import { isTickAuthorized } from "@/platform/jobs/tick-secret";
import { platformRoutes } from "@/platform/modules/platform-routes";
import { readScheduledJobs } from "@/shell/scheduled-jobs";

const UNAUTHORIZED_STATUS = 401;

async function tick(request: Request) {
  const database = getDatabase();
  if (!(await isTickAuthorized(database, process.env, request))) {
    return Response.json({ message: "This needs the jobs tick secret." }, { status: UNAUTHORIZED_STATUS });
  }
  const outcomes = await runDueJobs(database, process.env, await readScheduledJobs(database));
  return Response.json({ outcomes }, { headers: { "Cache-Control": "no-store" } });
}

// POST for schedulers and the self-tick. GET because Vercel Cron only sends GET.
export const POST = platformRoutes.open("jobs-tick", tick);
export const GET = platformRoutes.open("jobs-tick", tick);
