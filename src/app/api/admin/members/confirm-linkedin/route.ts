import { memberIdBodySchema } from "@/modules/members/contract-invites";
import { confirmLinkedinClaim } from "@/modules/members/service-admin";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "member-confirm-linkedin",
  memberIdBodySchema,
  async (context, { memberId }) => {
    await confirmLinkedinClaim(context, memberId);
    logAdminAction("linkedin_claim_confirmed", context.member.id, memberId);
    return Response.json({ message: "Confirmed. They now appear as a way in." });
  },
  { adminOnly: true },
);
