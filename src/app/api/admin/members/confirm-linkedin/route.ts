import { memberIdBodySchema } from "@/lib/invites/invite-api";
import { confirmLinkedinClaim } from "@/lib/members/member-admin";
import { logAdminAction } from "@/lib/route-logging";
import { createMemberRoute } from "@/lib/village/member-route";

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
