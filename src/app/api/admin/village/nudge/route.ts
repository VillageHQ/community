import { z } from "zod";

import { NUDGE_AUDIENCES, nudgeUnconnectedMembers } from "@/modules/network/service-nudge";
import { logAdminAction } from "@/platform/observability/route-logging";
import { networkRoutes } from "@/modules/network/routes";

const nudgeBodySchema = z.object({ audience: z.enum([NUDGE_AUDIENCES.unconnected, NUDGE_AUDIENCES.noAsks]).optional() }).strict();

function describeNudge(queuedCount: number) {
  if (queuedCount === 0) return "Nobody to remind right now. Each member gets at most one reminder every 30 days.";
  return "Nudge sent.";
}

export const POST = networkRoutes.member(
  "admin-connect-nudge",
  nudgeBodySchema,
  async (context, body) => {
    const queuedCount = await nudgeUnconnectedMembers(context, new Date(), body.audience);
    logAdminAction("connect_nudge_sent", context.member.id, String(queuedCount));
    return Response.json({ message: describeNudge(queuedCount) });
  },
  { adminOnly: true },
);
