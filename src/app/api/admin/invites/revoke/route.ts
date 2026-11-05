import { inviteIdBodySchema } from "@/modules/members/contract-invites";
import { revokeInvite } from "@/modules/members/service-invites";
import { membersRoutes } from "@/modules/members/routes";

export const POST = membersRoutes.member(
  "invite-revoke",
  inviteIdBodySchema,
  async (context, { inviteId }) => {
    await revokeInvite(context, inviteId);
    return Response.json({ message: "Invite revoked." });
  },
  { adminOnly: true },
);
