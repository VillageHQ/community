import { adminMemberIdBodySchema } from "@/modules/admin/contract";
import { unbanMember } from "@/modules/admin/service-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "admin-member-unban",
  adminMemberIdBodySchema,
  async (context, { memberId }) => {
    const name = await unbanMember(context, memberId);
    logAdminAction("member_unbanned", context.member.id, memberId);
    return Response.json({ message: `${name} can sign in again.` });
  },
  { adminOnly: true },
);
