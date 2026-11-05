import { adminMemberIdBodySchema } from "@/modules/admin/contract";
import { retryGroupDeparture } from "@/modules/admin/service-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-member-leave-group",
  adminMemberIdBodySchema,
  async (context, { memberId }) => {
    const departure = await retryGroupDeparture(context, memberId);
    logAdminAction("member_group_departure_retried", context.member.id, memberId);
    return Response.json(departure);
  },
  { adminOnly: true },
);
