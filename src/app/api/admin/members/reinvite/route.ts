import { adminMemberIdBodySchema } from "@/lib/admin/admin-api";
import { reinviteRemovedMember } from "@/lib/admin/member-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-member-reinvite",
  adminMemberIdBodySchema,
  async (context, { memberId }) => {
    const issued = await reinviteRemovedMember(context, memberId);
    logAdminAction("member_reinvited", context.member.id, memberId);
    return Response.json(issued);
  },
  { adminOnly: true },
);
