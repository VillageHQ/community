import { inviteIdBodySchema } from "@/lib/invites/invite-api";
import { revokeInvite } from "@/lib/invites/invites";
import { createMemberRoute } from "@/platform/village/member-routes";

export const POST = createMemberRoute(
  "invite-revoke",
  inviteIdBodySchema,
  async (context, { inviteId }) => {
    await revokeInvite(context, inviteId);
    return Response.json({ message: "Invite revoked." });
  },
  { adminOnly: true },
);
