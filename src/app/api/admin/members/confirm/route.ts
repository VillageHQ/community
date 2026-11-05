import { memberIdBodySchema } from "@/modules/members/contract-invites";
import { confirmMemberEmail } from "@/modules/members/service-admin";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "member-confirm-email",
  memberIdBodySchema,
  async (context, { memberId }) => {
    await confirmMemberEmail(context, memberId);
    logAdminAction("member_email_confirmed", context.member.id, memberId);
    return Response.json({ message: "Confirmed. Network search is on for them." });
  },
  { adminOnly: true },
);
