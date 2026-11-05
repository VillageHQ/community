import { memberIdBodySchema } from "@/modules/members/contract-invites";
import { confirmMemberEmail } from "@/modules/members/service-admin";
import { logAdminAction } from "@/platform/observability/route-logging";
import { adminRoutes } from "@/modules/admin/routes";
import { networkManifest } from "@/modules/network/manifest";
import { isModuleEnabled } from "@/platform/modules/enablement";

export const POST = adminRoutes.member(
  "member-confirm-email",
  memberIdBodySchema,
  async (context, { memberId }) => {
    await confirmMemberEmail(context, memberId);
    logAdminAction("member_email_confirmed", context.member.id, memberId);
    const isNetworkOn = await isModuleEnabled(context.database, networkManifest);
    return Response.json({ message: isNetworkOn ? "Confirmed. Network search is on for them." : "Confirmed." });
  },
  { adminOnly: true },
);
