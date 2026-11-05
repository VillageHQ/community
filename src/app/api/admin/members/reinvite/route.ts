import { adminMemberIdBodySchema } from "@/lib/admin/admin-api";
import { reinviteRemovedMember } from "@/lib/invites/invites";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

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
