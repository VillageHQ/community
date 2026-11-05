import { adminMemberIdBodySchema } from "@/modules/admin/contract";
import { reinviteRemovedMember } from "@/modules/admin/service-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-member-reinvite",
  adminMemberIdBodySchema,
  async (context, { memberId }) => {
    const issued = await reinviteRemovedMember(context, memberId);
    logAdminAction("member_reinvited", context.member.id, memberId);
    return Response.json(issued);
  },
  { adminOnly: true },
);
