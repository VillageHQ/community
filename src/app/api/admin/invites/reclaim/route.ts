import { inviteIdBodySchema } from "@/lib/invites/invite-api";
import { reclaimInvite } from "@/lib/invites/invites";
import { logAdminAction } from "@/platform/observability/route-logging";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "invite-reclaim",
  inviteIdBodySchema,
  async (context, { inviteId }) => {
    const issued = await reclaimInvite(context, inviteId);
    logAdminAction("invite_reclaimed", context.member.id, inviteId);
    return Response.json(issued);
  },
  { adminOnly: true },
);
