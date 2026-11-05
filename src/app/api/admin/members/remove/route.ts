import { removeMemberBodySchema } from "@/modules/admin/contract";
import { removeMember } from "@/modules/admin/service-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-member-remove",
  removeMemberBodySchema,
  async (context, body) => {
    const departure = await removeMember(context, body);
    logAdminAction("member_removed", context.member.id, body.memberId);
    return Response.json(departure);
  },
  { adminOnly: true },
);
