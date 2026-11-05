import { linkedinClaimBodySchema } from "@/lib/invites/invite-api";
import { clearLinkedinClaim } from "@/lib/members/member-admin";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "member-clear-linkedin",
  linkedinClaimBodySchema,
  async (context, { linkedinUrl }) => {
    const holderName = await clearLinkedinClaim(context, linkedinUrl);
    logAdminAction("linkedin_claim_cleared", context.member.id, holderName);
    return Response.json({ message: `Cleared from ${holderName}. They can add their own profile again.` });
  },
  { adminOnly: true },
);
