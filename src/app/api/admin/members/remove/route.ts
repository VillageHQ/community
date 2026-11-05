import { removeMemberBodySchema } from "@/lib/admin/admin-api";
import { removeMember } from "@/lib/admin/member-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

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
