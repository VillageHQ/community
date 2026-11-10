
import { emptyBodySchema } from "@/platform/http/contract";
import { runFillInNow, type FillInRun } from "@/modules/network/service-fill-in";
import { logAdminAction } from "@/platform/observability/route-logging";
import { networkRoutes } from "@/modules/network/routes";

const RUN_DEADLINE_MS = 5 * 60_000;

function describeRun({ checked, found, stoppedBy }: FillInRun) {
  if (stoppedBy === "monthly_cap") return `Stopped at this month's cap after ${checked} members. ${found} filled in.`;
  if (stoppedBy === "out_of_credits") return `Village is out of credits. ${found} of ${checked} members filled in before it stopped.`;
  if (stoppedBy === "village_unreachable") return "Village didn't answer, so nobody else was looked up. Try again later.";
  if (stoppedBy === "time_budget") return `${found} of ${checked} members filled in. The rest are filled in tonight.`;
  if (checked === 0) return "Everyone who allows it is already up to date.";
  return `Done. ${found} of ${checked} members filled in.`;
}

export const POST = networkRoutes.member(
  "admin-fill-in-run",
  emptyBodySchema,
  async (context) => {
    const run = await runFillInNow(context);
    logAdminAction("fill_in_run", context.member.id, String(run.checked));
    return Response.json({ message: describeRun(run) });
  },
  { adminOnly: true, deadlineMs: RUN_DEADLINE_MS },
);
