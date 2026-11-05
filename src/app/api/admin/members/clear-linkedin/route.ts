import { linkedinClaimBodySchema } from "@/modules/members/contract-invites";
import { clearLinkedinClaim } from "@/modules/members/service-admin";
import { logAdminAction } from "@/platform/observability/route-logging";
import { adminRoutes } from "@/modules/admin/routes";

export const POST = adminRoutes.member(
  "member-clear-linkedin",
  linkedinClaimBodySchema,
  async (context, { linkedinUrl }) => {
    const holderName = await clearLinkedinClaim(context, linkedinUrl);
    logAdminAction("linkedin_claim_cleared", context.member.id, holderName);
    return Response.json({ message: `Cleared from ${holderName}. They can add their own profile again.` });
  },
  { adminOnly: true },
);
