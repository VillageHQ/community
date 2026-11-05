import { inviteIdBodySchema } from "@/modules/members/contract-invites";
import { resendInvite } from "@/modules/members/service-invites";
import { membersRoutes } from "@/modules/members/routes";

export const POST = membersRoutes.member(
  "invite-resend",
  inviteIdBodySchema,
  async (context, { inviteId }) => Response.json(await resendInvite(context, inviteId)),
  { adminOnly: true },
);
