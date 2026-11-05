import { adminMemberIdBodySchema } from "@/lib/admin/admin-api";
import { retryGroupDeparture } from "@/lib/admin/member-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "admin-member-leave-group",
  adminMemberIdBodySchema,
  async (context, { memberId }) => {
    const departure = await retryGroupDeparture(context, memberId);
    logAdminAction("member_group_departure_retried", context.member.id, memberId);
    return Response.json(departure);
  },
  { adminOnly: true },
);
