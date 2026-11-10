
import { emptyBodySchema } from "@/platform/http/contract";
import { nudgeUnconnectedMembers } from "@/modules/network/service-nudge";
import { logAdminAction } from "@/platform/observability/route-logging";
import { networkRoutes } from "@/modules/network/routes";

function describeNudge(queuedCount: number) {
  if (queuedCount === 0) return "Nobody to remind right now. Each member gets at most one reminder every 30 days.";
  return `Reminder on its way to ${queuedCount === 1 ? "1 member" : `${queuedCount} members`}.`;
}

export const POST = networkRoutes.member(
  "admin-connect-nudge",
  emptyBodySchema,
  async (context) => {
    const queuedCount = await nudgeUnconnectedMembers(context);
    logAdminAction("connect_nudge_sent", context.member.id, String(queuedCount));
    return Response.json({ message: describeNudge(queuedCount) });
  },
  { adminOnly: true },
);
