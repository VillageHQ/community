import { memberIdBodySchema } from "@/lib/invites/invite-api";
import { confirmMemberEmail } from "@/lib/members/member-admin";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

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
