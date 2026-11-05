import { removeMemberBodySchema } from "@/modules/admin/contract";
import { removeMember } from "@/modules/admin/service-roster";
import { runMemberRemovedEffects } from "@/shell/member-effects";
import { logAdminAction } from "@/platform/observability/route-logging";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-member-remove",
  removeMemberBodySchema,
  async (context, body) => {
    const departure = await removeMember(context, body, runMemberRemovedEffects);
    logAdminAction("member_removed", context.member.id, body.memberId);
    return Response.json(departure);
  },
  { adminOnly: true },
);
