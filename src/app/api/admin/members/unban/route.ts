import { adminMemberIdBodySchema } from "@/lib/admin/admin-api";
import { unbanMember } from "@/lib/admin/member-roster";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

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
