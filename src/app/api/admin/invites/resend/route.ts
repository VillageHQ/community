import { inviteIdBodySchema } from "@/lib/invites/invite-api";
import { resendInvite } from "@/lib/invites/invites";
import { createMemberRoute } from "@/lib/village/member-route";

export const POST = createMemberRoute(
  "invite-resend",
  inviteIdBodySchema,
  async (context, { inviteId }) => Response.json(await resendInvite(context, inviteId)),
  { adminOnly: true },
);
