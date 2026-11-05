import { inviteIdBodySchema } from "@/modules/members/contract-invites";
import { resendInvite } from "@/modules/members/service-invites";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "invite-resend",
  inviteIdBodySchema,
  async (context, { inviteId }) => Response.json(await resendInvite(context, inviteId)),
  { adminOnly: true },
);
