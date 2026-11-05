import { adminMemberIdBodySchema } from "@/modules/admin/contract";
import { unbanMember } from "@/modules/admin/service-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "admin-member-unban",
  adminMemberIdBodySchema,
  async (context, { memberId }) => {
    const name = await unbanMember(context, memberId);
    logAdminAction("member_unbanned", context.member.id, memberId);
    return Response.json({ message: `${name} can sign in again.` });
  },
  { adminOnly: true },
);
